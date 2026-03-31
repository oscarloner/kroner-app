import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import {
  CATEGORIES,
  type BankReportingTreatment,
  type BankTransactionKind,
  type BankTransactionLinkStatus,
  type EntryType
} from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type ApplyDecision = {
  transactionId: string;
  action: "import_new" | "link_existing" | "ignore" | "mark_transfer";
  type?: EntryType;
  cat?: string;
  workspaceId?: string | null;
  matchEntryId?: string | null;
  transactionKind?: BankTransactionKind;
};

type LinkDecision = {
  linkId: string;
  status: Extract<BankTransactionLinkStatus, "confirmed" | "rejected">;
};

type BankTransactionRow = {
  id: string;
  account_id: string;
  batch_id: string;
  booking_date: string | null;
  amount: number;
  payment_type: string;
  raw_label: string;
  normalized_label: string;
  entry_type: EntryType;
  source_workspace_id: string | null;
  source_fingerprint: string;
  transaction_kind: BankTransactionKind;
  reporting_treatment: BankReportingTreatment;
  suggested_entry_id: string | null;
  selected_entry_id: string | null;
};

type EntryRow = {
  id: string;
  cat: string;
  workspace_id: string | null;
  note: string | null;
};

type BatchRow = {
  id: string;
  default_workspace_id: string | null;
};

type TransactionLinkRow = {
  id: string;
  left_bank_transaction_id: string;
  right_bank_transaction_id: string;
};

function normalizeWorkspaceId(value: string | null | undefined) {
  return value || null;
}

function resolveCategory(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  return CATEGORIES.includes(value as (typeof CATEGORIES)[number]) ? value : fallback;
}

async function upsertLearningExample(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  accountId: string;
  userId: string;
  rawLabel: string;
  normalizedLabel: string;
  paymentType: string;
  entryType: EntryType;
  cat: string;
  workspaceId: string | null;
  sourceWorkspaceId: string | null;
  transactionKind: BankTransactionKind;
  reportingTreatment: BankReportingTreatment;
}) {
  const { error } = await args.supabase.from("bank_learning_examples").upsert(
    {
      account_id: args.accountId,
      created_by: args.userId,
      source_name: "nordea_csv",
      raw_label: args.rawLabel,
      normalized_label: args.normalizedLabel,
      payment_type: args.paymentType,
      entry_type: args.entryType,
      cat: args.cat,
      workspace_id: args.workspaceId,
      source_workspace_id: args.sourceWorkspaceId,
      transaction_kind: args.transactionKind,
      reporting_treatment: args.reportingTreatment,
      entry_name: args.rawLabel,
      usage_count: 1,
      last_confirmed_at: new Date().toISOString()
    },
    {
      onConflict: "account_id,normalized_label,payment_type,entry_type,cat,workspace_id",
      ignoreDuplicates: false
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const { accountId, decisions, linkDecisions } = (await request.json()) as {
      accountId?: string;
      decisions?: ApplyDecision[];
      linkDecisions?: LinkDecision[];
    };
    const account = await requireAccountAccess(accountId);
    const supabase = await createClient();

    if (!decisions || decisions.length === 0) {
      return NextResponse.json({ message: "Missing decisions." }, { status: 400 });
    }

    const { data: batch, error: batchError } = await supabase
      .from("bank_import_batches")
      .select("id, default_workspace_id")
      .eq("id", batchId)
      .eq("account_id", account.accountId)
      .single();

    if (batchError || !batch) {
      throw new Error(batchError?.message || "Could not load import batch.");
    }

    const { data: transactions, error: transactionError } = await supabase
      .from("bank_transactions")
      .select(
        "id, account_id, batch_id, booking_date, amount, payment_type, raw_label, normalized_label, entry_type, source_workspace_id, source_fingerprint, transaction_kind, reporting_treatment, suggested_entry_id, selected_entry_id"
      )
      .eq("batch_id", batchId)
      .eq("account_id", account.accountId)
      .in(
        "id",
        decisions.map((decision) => decision.transactionId)
      );

    if (transactionError) {
      throw new Error(transactionError.message);
    }

    const { data: links, error: linkError } = await supabase
      .from("transaction_links")
      .select("id, left_bank_transaction_id, right_bank_transaction_id")
      .eq("batch_id", batchId)
      .eq("account_id", account.accountId)
      .in(
        "id",
        (linkDecisions ?? []).map((decision) => decision.linkId).length > 0
          ? (linkDecisions ?? []).map((decision) => decision.linkId)
          : ["00000000-0000-0000-0000-000000000000"]
      );

    if (linkError) {
      throw new Error(linkError.message);
    }

    const transactionMap = new Map(
      ((transactions ?? []) as BankTransactionRow[]).map((row) => [row.id, row])
    );
    const entryIds = Array.from(
      new Set(
        [
          ...decisions.map((decision) => decision.matchEntryId),
          ...((transactions ?? []) as BankTransactionRow[]).map((transaction) => transaction.suggested_entry_id),
          ...((transactions ?? []) as BankTransactionRow[]).map((transaction) => transaction.selected_entry_id)
        ].filter((value): value is string => Boolean(value))
      )
    );

    const { data: linkedEntries, error: linkedEntryError } = await supabase
      .from("entries")
      .select("id, cat, workspace_id, note")
      .eq("account_id", account.accountId)
      .in("id", entryIds.length > 0 ? entryIds : ["00000000-0000-0000-0000-000000000000"]);

    if (linkedEntryError) {
      throw new Error(linkedEntryError.message);
    }

    const linkedEntryMap = new Map(((linkedEntries ?? []) as EntryRow[]).map((row) => [row.id, row]));
    const linkMap = new Map(((links ?? []) as TransactionLinkRow[]).map((row) => [row.id, row]));
    let appliedCount = 0;

    for (const decision of decisions) {
      const transaction = transactionMap.get(decision.transactionId);
      if (!transaction) {
        continue;
      }

      if (decision.action === "ignore") {
        const { error } = await supabase
          .from("bank_transactions")
          .update({ selected_action: "ignore", status: "ignored", reporting_treatment: "normal" })
          .eq("id", transaction.id);

        if (error) {
          throw new Error(error.message);
        }
        continue;
      }

      if (decision.action === "mark_transfer") {
        const { error } = await supabase
          .from("bank_transactions")
          .update({
            selected_action: "mark_transfer",
            status: "transfer",
            transaction_kind: "bank_transfer",
            reporting_treatment: "normal"
          })
          .eq("id", transaction.id);

        if (error) {
          throw new Error(error.message);
        }
        continue;
      }

      const chosenTransactionKind = decision.transactionKind ?? transaction.transaction_kind ?? "other";

      if (!transaction.booking_date) {
        continue;
      }

      if (decision.action === "link_existing") {
        const targetEntryId =
          decision.matchEntryId ?? transaction.selected_entry_id ?? transaction.suggested_entry_id;

        if (!targetEntryId) {
          throw new Error(`Missing target entry for ${transaction.raw_label}.`);
        }

        const linkedEntry = linkedEntryMap.get(targetEntryId);
        if (!linkedEntry) {
          throw new Error(`Could not load linked entry ${targetEntryId}.`);
        }

        const { error: updateEntryError } = await supabase
          .from("entries")
          .update({
            name: transaction.raw_label,
            raw_name: transaction.raw_label,
            amount: transaction.amount,
            type: transaction.entry_type,
            date: transaction.booking_date,
            source_workspace_id: transaction.source_workspace_id,
            transaction_kind: chosenTransactionKind,
            reporting_treatment: transaction.reporting_treatment,
            source_type: "nordea_csv",
            source_name: "Nordea",
            source_fingerprint: transaction.source_fingerprint,
            payment_type: transaction.payment_type,
            import_batch_id: batchId,
            match_status: "linked"
          })
          .eq("id", targetEntryId)
          .eq("account_id", account.accountId);

        if (updateEntryError) {
          throw new Error(updateEntryError.message);
        }

        const { error: updateTransactionError } = await supabase
          .from("bank_transactions")
          .update({
            selected_action: "link_existing",
            selected_entry_id: targetEntryId,
            applied_entry_id: targetEntryId,
            transaction_kind: chosenTransactionKind,
            status: "linked"
          })
          .eq("id", transaction.id);

        if (updateTransactionError) {
          throw new Error(updateTransactionError.message);
        }

        await upsertLearningExample({
          supabase,
          accountId: account.accountId,
          userId: account.user.id,
          rawLabel: transaction.raw_label,
          normalizedLabel: transaction.normalized_label,
          paymentType: transaction.payment_type,
          entryType: transaction.entry_type,
          cat: linkedEntry.cat,
          workspaceId: linkedEntry.workspace_id,
          sourceWorkspaceId: transaction.source_workspace_id,
          transactionKind: chosenTransactionKind,
          reportingTreatment: transaction.reporting_treatment
        });

        appliedCount += 1;
        continue;
      }

      const chosenType = decision.type ?? transaction.entry_type;
      const chosenCat = resolveCategory(decision.cat, "Annet");
      const workspaceId = normalizeWorkspaceId(
        decision.workspaceId ?? ((batch as BatchRow).default_workspace_id ?? null)
      );
      const { data: existingByFingerprint, error: existingError } = await supabase
        .from("entries")
        .select("id")
        .eq("account_id", account.accountId)
        .eq("source_fingerprint", transaction.source_fingerprint)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      const appliedEntryId = existingByFingerprint?.id ?? null;

      if (appliedEntryId) {
        const { error: updateExistingError } = await supabase
          .from("entries")
          .update({
            name: transaction.raw_label,
            raw_name: transaction.raw_label,
            amount: transaction.amount,
            type: chosenType,
            cat: chosenCat,
            workspace_id: workspaceId,
            source_workspace_id: transaction.source_workspace_id,
            transaction_kind: chosenTransactionKind,
            reporting_treatment: transaction.reporting_treatment,
            date: transaction.booking_date,
            source_type: "nordea_csv",
            source_name: "Nordea",
            source_fingerprint: transaction.source_fingerprint,
            payment_type: transaction.payment_type,
            import_batch_id: batchId,
            match_status: "imported"
          })
          .eq("id", appliedEntryId)
          .eq("account_id", account.accountId);

        if (updateExistingError) {
          throw new Error(updateExistingError.message);
        }

        const { error: txUpdateError } = await supabase
          .from("bank_transactions")
          .update({
            selected_action: "import_new",
            applied_entry_id: appliedEntryId,
            transaction_kind: chosenTransactionKind,
            status: "applied"
          })
          .eq("id", transaction.id);

        if (txUpdateError) {
          throw new Error(txUpdateError.message);
        }

        await upsertLearningExample({
          supabase,
          accountId: account.accountId,
          userId: account.user.id,
          rawLabel: transaction.raw_label,
          normalizedLabel: transaction.normalized_label,
          paymentType: transaction.payment_type,
          entryType: chosenType,
          cat: chosenCat,
          workspaceId,
          sourceWorkspaceId: transaction.source_workspace_id,
          transactionKind: chosenTransactionKind,
          reportingTreatment: transaction.reporting_treatment
        });

        appliedCount += 1;
        continue;
      }

      const { data: insertedEntry, error: insertEntryError } = await supabase
        .from("entries")
        .insert({
          account_id: account.accountId,
          created_by: account.user.id,
          legacy_id: null,
          name: transaction.raw_label,
          raw_name: transaction.raw_label,
          amount: transaction.amount,
          type: chosenType,
          cat: chosenCat,
          workspace_id: workspaceId,
          source_workspace_id: transaction.source_workspace_id,
          transaction_kind: chosenTransactionKind,
          reporting_treatment: transaction.reporting_treatment,
          date: transaction.booking_date,
          link: null,
          note: null,
          source_type: "nordea_csv",
          source_name: "Nordea",
          source_transaction_id: null,
          source_fingerprint: transaction.source_fingerprint,
          payment_type: transaction.payment_type,
          import_batch_id: batchId,
          match_status: "imported"
        })
        .select("id")
        .single();

      if (insertEntryError || !insertedEntry) {
        throw new Error(insertEntryError?.message || "Could not create entry from bank import.");
      }

      const { error: updateTransactionError } = await supabase
        .from("bank_transactions")
        .update({
          selected_action: "import_new",
          applied_entry_id: insertedEntry.id,
          transaction_kind: chosenTransactionKind,
          status: "applied"
        })
        .eq("id", transaction.id);

      if (updateTransactionError) {
        throw new Error(updateTransactionError.message);
      }

      await upsertLearningExample({
        supabase,
        accountId: account.accountId,
        userId: account.user.id,
        rawLabel: transaction.raw_label,
        normalizedLabel: transaction.normalized_label,
        paymentType: transaction.payment_type,
        entryType: chosenType,
        cat: chosenCat,
        workspaceId,
        sourceWorkspaceId: transaction.source_workspace_id,
        transactionKind: chosenTransactionKind,
        reportingTreatment: transaction.reporting_treatment
      });

      appliedCount += 1;
    }

    for (const linkDecision of linkDecisions ?? []) {
      const link = linkMap.get(linkDecision.linkId);
      if (!link) {
        continue;
      }

      const nextTreatment = linkDecision.status === "confirmed" ? "offset_hidden" : "normal";
      const { error: updateLinkError } = await supabase
        .from("transaction_links")
        .update({ status: linkDecision.status })
        .eq("id", link.id)
        .eq("batch_id", batchId)
        .eq("account_id", account.accountId);

      if (updateLinkError) {
        throw new Error(updateLinkError.message);
      }

      const { error: updateTxError } = await supabase
        .from("bank_transactions")
        .update({ reporting_treatment: nextTreatment })
        .eq("batch_id", batchId)
        .eq("account_id", account.accountId)
        .in("id", [link.left_bank_transaction_id, link.right_bank_transaction_id]);

      if (updateTxError) {
        throw new Error(updateTxError.message);
      }

      if (linkDecision.status === "confirmed") {
        const linkedTransactions = [link.left_bank_transaction_id, link.right_bank_transaction_id]
          .map((id) => transactionMap.get(id))
          .filter((value): value is BankTransactionRow => Boolean(value));

        for (const transaction of linkedTransactions) {
          await upsertLearningExample({
            supabase,
            accountId: account.accountId,
            userId: account.user.id,
            rawLabel: transaction.raw_label,
            normalizedLabel: transaction.normalized_label,
            paymentType: transaction.payment_type,
            entryType: transaction.entry_type,
            cat: "Annet",
            workspaceId: null,
            sourceWorkspaceId: transaction.source_workspace_id,
            transactionKind: transaction.transaction_kind,
            reportingTreatment: "offset_hidden"
          });
        }
      }
    }

    const { error: batchUpdateError } = await supabase
      .from("bank_import_batches")
      .update({ status: "applied" })
      .eq("id", batchId)
      .eq("account_id", account.accountId);

    if (batchUpdateError) {
      throw new Error(batchUpdateError.message);
    }

    return NextResponse.json({
      message: `Bankimport fullført. ${appliedCount} transaksjoner skrevet til regnskapet.`
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not apply bank import."
      },
      { status: 500 }
    );
  }
}
