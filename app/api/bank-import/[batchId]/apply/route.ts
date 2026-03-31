import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { CATEGORIES, type EntryType } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type ApplyDecision = {
  transactionId: string;
  action: "import_new" | "link_existing" | "ignore" | "mark_transfer";
  type?: EntryType;
  cat?: string;
  workspaceId?: string | null;
  matchEntryId?: string | null;
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
  source_fingerprint: string;
  suggested_entry_id: string | null;
  selected_entry_id: string | null;
};

type EntryRow = {
  id: string;
  cat: string;
  workspace_id: string | null;
  note: string | null;
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

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    const { accountId, decisions } = (await request.json()) as {
      accountId?: string;
      decisions?: ApplyDecision[];
    };
    const account = await requireAccountAccess(accountId);
    const supabase = await createClient();

    if (!decisions || decisions.length === 0) {
      return NextResponse.json({ message: "Missing decisions." }, { status: 400 });
    }

    const { data: transactions, error: transactionError } = await supabase
      .from("bank_transactions")
      .select(
        "id, account_id, batch_id, booking_date, amount, payment_type, raw_label, normalized_label, entry_type, source_fingerprint, suggested_entry_id, selected_entry_id"
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
    let appliedCount = 0;

    for (const decision of decisions) {
      const transaction = transactionMap.get(decision.transactionId);
      if (!transaction) {
        continue;
      }

      if (decision.action === "ignore") {
        const { error } = await supabase
          .from("bank_transactions")
          .update({ selected_action: "ignore", status: "ignored" })
          .eq("id", transaction.id);

        if (error) {
          throw new Error(error.message);
        }
        continue;
      }

      if (decision.action === "mark_transfer") {
        const { error } = await supabase
          .from("bank_transactions")
          .update({ selected_action: "mark_transfer", status: "transfer" })
          .eq("id", transaction.id);

        if (error) {
          throw new Error(error.message);
        }
        continue;
      }

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
            status: "linked"
          })
          .eq("id", transaction.id);

        if (updateTransactionError) {
          throw new Error(updateTransactionError.message);
        }

        await supabase.from("bank_learning_examples").insert({
          account_id: account.accountId,
          created_by: account.user.id,
          source_name: "nordea_csv",
          raw_label: transaction.raw_label,
          normalized_label: transaction.normalized_label,
          payment_type: transaction.payment_type,
          entry_type: transaction.entry_type,
          cat: linkedEntry.cat,
          workspace_id: linkedEntry.workspace_id,
          entry_name: transaction.raw_label
        });

        appliedCount += 1;
        continue;
      }

      const chosenType = decision.type ?? transaction.entry_type;
      const chosenCat = resolveCategory(decision.cat, "Annet");
      const workspaceId = normalizeWorkspaceId(decision.workspaceId);
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
            status: "applied"
          })
          .eq("id", transaction.id);

        if (txUpdateError) {
          throw new Error(txUpdateError.message);
        }

        await supabase.from("bank_learning_examples").insert({
          account_id: account.accountId,
          created_by: account.user.id,
          source_name: "nordea_csv",
          raw_label: transaction.raw_label,
          normalized_label: transaction.normalized_label,
          payment_type: transaction.payment_type,
          entry_type: chosenType,
          cat: chosenCat,
          workspace_id: workspaceId,
          entry_name: transaction.raw_label
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
          status: "applied"
        })
        .eq("id", transaction.id);

      if (updateTransactionError) {
        throw new Error(updateTransactionError.message);
      }

      await supabase.from("bank_learning_examples").insert({
        account_id: account.accountId,
        created_by: account.user.id,
        source_name: "nordea_csv",
        raw_label: transaction.raw_label,
        normalized_label: transaction.normalized_label,
        payment_type: transaction.payment_type,
        entry_type: chosenType,
        cat: chosenCat,
        workspace_id: workspaceId,
        entry_name: transaction.raw_label
      });

      appliedCount += 1;
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
