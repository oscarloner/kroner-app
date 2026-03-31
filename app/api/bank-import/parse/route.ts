import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { parseNordeaCsv } from "@/lib/bank-import";
import {
  buildSuggestedTransactionLinks,
  buildReviewItemsFromParsed,
  fetchBankLearningExamples,
  fetchExistingEntryMatches,
  splitParsedReviewItems,
  summarizeParsedRows
} from "@/lib/bank-import-server";
import type {
  BankImportAction,
  BankImportReviewItem,
  BankReportingTreatment,
  BankTransactionKind,
  EntryType
} from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

function resolveCategory(value: string | undefined) {
  return value || "Annet";
}

function normalizeWorkspaceId(value: string | null | undefined) {
  return value || null;
}

async function applyImportNew(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  accountId: string;
  userId: string;
  batchId: string;
  lineNumber: number;
  bookingDate: string;
  amount: number;
  paymentType: string;
  rawLabel: string;
  normalizedLabel: string;
  entryType: EntryType;
  sourceFingerprint: string;
  sourceWorkspaceId: string | null;
  type: EntryType;
  cat: string;
  workspaceId: string | null;
  transactionKind: BankTransactionKind;
  reportingTreatment: BankReportingTreatment;
}) {
  const existingByFingerprint = await args.supabase
    .from("entries")
    .select("id")
    .eq("account_id", args.accountId)
    .eq("source_fingerprint", args.sourceFingerprint)
    .maybeSingle();

  if (existingByFingerprint.error) {
    throw new Error(existingByFingerprint.error.message);
  }

  const appliedEntryId = existingByFingerprint.data?.id ?? null;

  if (appliedEntryId) {
    const { error } = await args.supabase
      .from("entries")
      .update({
        name: args.rawLabel,
        raw_name: args.rawLabel,
        amount: args.amount,
        type: args.type,
        cat: args.cat,
        workspace_id: args.workspaceId,
        source_workspace_id: args.sourceWorkspaceId,
        transaction_kind: args.transactionKind,
        reporting_treatment: args.reportingTreatment,
        date: args.bookingDate,
        source_type: "nordea_csv",
        source_name: "Nordea",
        source_fingerprint: args.sourceFingerprint,
        payment_type: args.paymentType,
        import_batch_id: args.batchId,
        match_status: "imported"
      })
      .eq("id", appliedEntryId)
      .eq("account_id", args.accountId);

    if (error) {
      throw new Error(error.message);
    }

    const { error: updateTransactionError } = await args.supabase
      .from("bank_transactions")
      .update({
        selected_action: "import_new",
        applied_entry_id: appliedEntryId,
        transaction_kind: args.transactionKind,
        reporting_treatment: args.reportingTreatment,
        status: "applied"
      })
      .eq("batch_id", args.batchId)
      .eq("line_number", args.lineNumber);

    if (updateTransactionError) {
      throw new Error(updateTransactionError.message);
    }
  } else {
    const insertedEntry = await args.supabase
      .from("entries")
      .insert({
        account_id: args.accountId,
        created_by: args.userId,
        legacy_id: null,
        name: args.rawLabel,
        raw_name: args.rawLabel,
        amount: args.amount,
        type: args.type,
        cat: args.cat,
        workspace_id: args.workspaceId,
        source_workspace_id: args.sourceWorkspaceId,
        transaction_kind: args.transactionKind,
        reporting_treatment: args.reportingTreatment,
        date: args.bookingDate,
        link: null,
        note: null,
        source_type: "nordea_csv",
        source_name: "Nordea",
        source_transaction_id: null,
        source_fingerprint: args.sourceFingerprint,
        payment_type: args.paymentType,
        import_batch_id: args.batchId,
        match_status: "imported"
      })
      .select("id")
      .single();

    if (insertedEntry.error || !insertedEntry.data) {
      throw new Error(insertedEntry.error?.message || "Could not create entry from bank import.");
    }

    const { error: updateTransactionError } = await args.supabase
      .from("bank_transactions")
      .update({
        selected_action: "import_new",
        applied_entry_id: insertedEntry.data.id,
        transaction_kind: args.transactionKind,
        reporting_treatment: args.reportingTreatment,
        status: "applied"
      })
      .eq("batch_id", args.batchId)
      .eq("line_number", args.lineNumber);

    if (updateTransactionError) {
      throw new Error(updateTransactionError.message);
    }
  }

  await args.supabase.from("bank_learning_examples").upsert(
    {
      account_id: args.accountId,
      created_by: args.userId,
      source_name: "nordea_csv",
      raw_label: args.rawLabel,
      normalized_label: args.normalizedLabel,
      payment_type: args.paymentType,
      entry_type: args.type,
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
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const accountId = formData.get("accountId");
    const workspaceId = formData.get("workspaceId");
    const file = formData.get("file");

    if (typeof accountId !== "string") {
      return NextResponse.json({ message: "Missing accountId." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Missing CSV file." }, { status: 400 });
    }

    if (typeof workspaceId !== "string" || workspaceId.length === 0) {
      return NextResponse.json({ message: "Velg prosjekt/selskap for denne CSV-importen." }, { status: 400 });
    }

    const account = await requireAccountAccess(accountId);
    const csvText = await file.text();
    const parsedRows = parseNordeaCsv(csvText);

    if (parsedRows.length === 0) {
      return NextResponse.json({ message: "CSV-filen var tom." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("account_id", account.accountId)
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError) {
      throw new Error(workspaceError.message);
    }

    if (!workspace) {
      return NextResponse.json({ message: "Ugyldig prosjekt/selskap for valgt konto." }, { status: 400 });
    }

    const { data: batch, error: batchError } = await supabase
      .from("bank_import_batches")
      .insert({
        account_id: account.accountId,
        created_by: account.user.id,
        provider: "nordea_csv",
        source_name: "Nordea",
        file_name: file.name,
        default_workspace_id: workspace.id,
        status: "parsed"
      })
      .select("id, default_workspace_id")
      .single();

    if (batchError || !batch) {
      throw new Error(batchError?.message || "Could not create import batch.");
    }

    const [entries, learningExamples] = await Promise.all([
      fetchExistingEntryMatches(account.accountId),
      fetchBankLearningExamples(account.accountId)
    ]);
    const importContext = {
      defaultWorkspaceId: workspace.id,
      defaultWorkspaceName: workspace.name
    };
    const reviewItems = buildReviewItemsFromParsed(
      batch.id,
      parsedRows,
      entries,
      learningExamples,
      importContext
    );
    const { autoApply, needsReview } = splitParsedReviewItems(reviewItems, importContext);
    const rowMap = new Map(parsedRows.map((row) => [row.lineNumber, row]));
    const autoApplyMap = new Map(autoApply.map((candidate) => [candidate.item.id, candidate]));
    const transactionRows = reviewItems.map((item) => {
      const lineNumber = Number(item.id.split(":")[1]);
      const parsed = rowMap.get(lineNumber);
      const candidate = autoApplyMap.get(item.id);
      const selectedAction: BankImportAction | null = candidate?.action ?? null;
      const status =
        candidate?.action === "ignore"
          ? "ignored"
          : candidate?.action === "import_new"
            ? "applied"
            : "pending";

      return {
        batch_id: batch.id,
        account_id: account.accountId,
        created_by: account.user.id,
        line_number: lineNumber,
        booking_date: parsed?.bookingDate ?? null,
        raw_booking_date: parsed?.rawBookingDate ?? "",
        amount: item.amount,
        currency: item.currency,
        payment_type: item.paymentType,
        sender: parsed?.sender ?? null,
        receiver: parsed?.receiver ?? null,
        title: parsed?.title ?? null,
        name: parsed?.name ?? null,
        raw_label: item.rawLabel,
        normalized_label: item.normalizedLabel,
        entry_type: item.entryType,
        source_workspace_id: importContext.defaultWorkspaceId,
        source_fingerprint: parsed?.sourceFingerprint ?? "",
        transaction_kind: item.transactionKind,
        confidence_score: item.confidenceScore,
        classification_source: item.classificationSource,
        review_reason: item.reviewReason,
        project_workspace_id: item.suggestion?.workspaceId ?? importContext.defaultWorkspaceId,
        reporting_treatment: item.reportingTreatment,
        review_group: item.reviewGroup,
        suggested_action: item.suggestedAction,
        suggested_entry_id: item.suggestedMatch?.entryId ?? null,
        suggested_match_score: item.suggestedMatch?.score ?? 0,
        selected_action: selectedAction,
        status,
        raw_data: {
          ...parsed?.rawData,
          isOwnTransfer: item.isOwnTransfer,
          isReserved: item.isReserved
        }
      };
    });

    const { data: insertedTransactions, error: insertError } = await supabase
      .from("bank_transactions")
      .insert(transactionRows)
      .select(
        "id, batch_id, booking_date, amount, currency, payment_type, raw_label, normalized_label, entry_type, review_group, suggested_action, selected_action, transaction_kind, confidence_score, classification_source, review_reason, reporting_treatment, suggested_match_score, suggested_entry_id, selected_entry_id, applied_entry_id, raw_data, status"
      );

    if (insertError) {
      throw new Error(insertError.message);
    }

    const insertedRows = (insertedTransactions ?? []) as Array<{
      id: string;
      batch_id: string;
      booking_date: string | null;
      amount: number;
      currency: string;
      payment_type: string;
      raw_label: string;
      normalized_label: string;
      entry_type: EntryType;
      review_group: BankImportReviewItem["reviewGroup"];
      suggested_action: BankImportReviewItem["suggestedAction"];
      selected_action: BankImportReviewItem["selectedAction"];
      transaction_kind: BankTransactionKind;
      confidence_score: number;
      classification_source: "rule" | "history" | "match" | "manual" | null;
      review_reason: string | null;
      reporting_treatment: BankReportingTreatment;
      suggested_match_score: number;
      suggested_entry_id: string | null;
      selected_entry_id: string | null;
      applied_entry_id: string | null;
      raw_data: { isOwnTransfer?: boolean; isReserved?: boolean };
      status: "pending" | "applied" | "ignored" | "transfer" | "linked";
    }>;

    const suggestedLinks = buildSuggestedTransactionLinks(insertedRows.filter((row) => row.status === "pending"));

    if (suggestedLinks.length > 0) {
      const linkInserts = suggestedLinks.map((link) => ({
        account_id: account.accountId,
        batch_id: batch.id,
        left_bank_transaction_id: link.leftTransactionId,
        right_bank_transaction_id: link.rightTransactionId,
        link_kind: link.linkKind,
        confidence_score: link.confidenceScore,
        status: "suggested" as const,
        net_effect_direction: "net"
      }));

      const { error: linkInsertError } = await supabase.from("transaction_links").insert(linkInserts);
      if (linkInsertError) {
        throw new Error(linkInsertError.message);
      }

      const linkedIds = Array.from(
        new Set(suggestedLinks.flatMap((link) => [link.leftTransactionId, link.rightTransactionId]))
      );
      const { error: treatmentError } = await supabase
        .from("bank_transactions")
        .update({ reporting_treatment: "offset_candidate" })
        .eq("batch_id", batch.id)
        .in("id", linkedIds);

      if (treatmentError) {
        throw new Error(treatmentError.message);
      }
    }

    for (const candidate of autoApply) {
      const lineNumber = Number(candidate.item.id.split(":")[1]);
      const parsed = rowMap.get(lineNumber);

      if (candidate.action === "ignore") {
        continue;
      }

      if (!parsed?.bookingDate) {
        continue;
      }

      await applyImportNew({
        supabase,
        accountId: account.accountId,
        userId: account.user.id,
        batchId: batch.id,
        lineNumber,
        bookingDate: parsed.bookingDate,
        amount: candidate.item.amount,
        paymentType: candidate.item.paymentType,
        rawLabel: candidate.item.rawLabel,
        normalizedLabel: candidate.item.normalizedLabel,
        entryType: candidate.item.entryType,
        sourceFingerprint: parsed.sourceFingerprint,
        sourceWorkspaceId: importContext.defaultWorkspaceId,
        type: candidate.item.suggestion?.type ?? candidate.item.entryType,
        cat: resolveCategory(candidate.item.suggestion?.cat),
        workspaceId: normalizeWorkspaceId(
          candidate.item.suggestion?.workspaceId ?? importContext.defaultWorkspaceId
        ),
        transactionKind: candidate.item.transactionKind,
        reportingTreatment: candidate.item.reportingTreatment
      });
    }

    const parsedSummary = summarizeParsedRows(needsReview);
    const summary = {
      ...parsedSummary,
      total: reviewItems.length,
      autoAppliedCount: autoApply.filter((candidate) => candidate.action === "import_new").length,
      ignoredCount: autoApply.filter((candidate) => candidate.action === "ignore").length,
      batchCompleted: needsReview.length === 0
    };

    if (summary.batchCompleted) {
      const { error: batchUpdateError } = await supabase
        .from("bank_import_batches")
        .update({ status: "applied" })
        .eq("id", batch.id)
        .eq("account_id", account.accountId);

      if (batchUpdateError) {
        throw new Error(batchUpdateError.message);
      }
    }

    return NextResponse.json({
      batchId: batch.id,
      importContext,
      summary
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not parse bank CSV."
      },
      { status: 500 }
    );
  }
}
