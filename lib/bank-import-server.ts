import {
  findProbableMatch,
  selectBankSuggestion,
  summarizeReviewItems,
  type BankLearningExample,
  type ExistingEntryMatch,
  type ParsedNordeaTransaction
} from "@/lib/bank-import";
import { createClient } from "@/lib/supabase/server";
import type {
  BankImportContext,
  BankImportReviewItem,
  BankImportReviewSummary,
  BankMatchCandidate,
  EntryType
} from "@/lib/types";

type EntryRow = {
  id: string;
  name: string;
  raw_name: string | null;
  amount: number;
  type: EntryType;
  cat: string;
  workspace_id: string | null;
  date: string;
  source_fingerprint: string | null;
  payment_type: string | null;
};

type BankTransactionRow = {
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
  suggested_match_score: number;
  suggested_entry_id: string | null;
  selected_entry_id: string | null;
  raw_data: { isOwnTransfer?: boolean; isReserved?: boolean };
};

type LearningRow = {
  normalized_label: string;
  raw_label: string;
  payment_type: string;
  entry_type: EntryType;
  cat: string;
  workspace_id: string | null;
  usage_count: number;
};

type BatchRow = {
  id: string;
  default_workspace_id: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string;
};

function hasWorkspaceConflict(
  suggestedMatch: BankMatchCandidate | null | undefined,
  importContext: BankImportContext | undefined
) {
  if (!suggestedMatch?.workspaceId || !importContext?.defaultWorkspaceId) {
    return false;
  }

  return suggestedMatch.workspaceId !== importContext.defaultWorkspaceId;
}

export async function fetchExistingEntryMatches(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, name, raw_name, amount, type, cat, workspace_id, date, source_fingerprint, payment_type"
    )
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as EntryRow[]).map<ExistingEntryMatch>((entry) => ({
    id: entry.id,
    name: entry.name,
    rawName: entry.raw_name,
    amount: Number(entry.amount),
    type: entry.type,
    cat: entry.cat,
    workspaceId: entry.workspace_id,
    date: entry.date,
    sourceFingerprint: entry.source_fingerprint,
    paymentType: entry.payment_type
  }));
}

export async function fetchBankLearningExamples(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_learning_examples")
    .select("normalized_label, raw_label, payment_type, entry_type, cat, workspace_id, usage_count")
    .eq("account_id", accountId)
    .order("usage_count", { ascending: false })
    .limit(300);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as LearningRow[]).map<BankLearningExample>((example) => ({
    normalizedLabel: example.normalized_label,
    rawLabel: example.raw_label,
    paymentType: example.payment_type,
    type: example.entry_type,
    cat: example.cat,
    workspaceId: example.workspace_id,
    usageCount: example.usage_count
  }));
}

export function buildStoredReviewItems(
  rows: BankTransactionRow[],
  entries: ExistingEntryMatch[],
  learningExamples: BankLearningExample[],
  importContext?: BankImportContext
) {
  return rows.map<BankImportReviewItem>((row) => {
    const suggestedMatch = row.suggested_entry_id
      ? findProbableMatch(
          {
            lineNumber: 0,
            bookingDate: row.booking_date,
            rawBookingDate: row.booking_date ?? "",
            amount: Number(row.amount),
            currency: row.currency,
            paymentType: row.payment_type,
            sender: null,
            receiver: null,
            title: null,
            name: null,
            rawLabel: row.raw_label,
            normalizedLabel: row.normalized_label,
            entryType: row.entry_type,
            sourceFingerprint: "",
            isReserved: Boolean(row.raw_data?.isReserved),
            isOwnTransfer: Boolean(row.raw_data?.isOwnTransfer),
            reviewGroup: row.review_group,
            suggestedAction: row.suggested_action,
            rawData: {}
          },
          entries.filter((entry) => entry.id === row.suggested_entry_id)
        )
      : null;

    const suggestion = selectBankSuggestion(
      {
        normalizedLabel: row.normalized_label,
        paymentType: row.payment_type,
        entryType: row.entry_type
      },
      learningExamples,
      suggestedMatch,
      importContext
    );

    return {
      id: row.id,
      batchId: row.batch_id,
      date: row.booking_date ?? "",
      amount: Number(row.amount),
      currency: row.currency,
      paymentType: row.payment_type,
      rawLabel: row.raw_label,
      normalizedLabel: row.normalized_label,
      entryType: row.entry_type,
      reviewGroup: row.review_group,
      suggestedAction: row.suggested_action,
      selectedAction: row.selected_action,
      suggestedMatch,
      suggestion,
      isOwnTransfer: Boolean(row.raw_data?.isOwnTransfer),
      isReserved: Boolean(row.raw_data?.isReserved)
    };
  });
}

export function buildReviewItemsFromParsed(
  batchId: string,
  parsedRows: ParsedNordeaTransaction[],
  entries: ExistingEntryMatch[],
  learningExamples: BankLearningExample[],
  importContext?: BankImportContext
) {
  return parsedRows.map<BankImportReviewItem>((row) => {
    const suggestedMatch = !row.isReserved && !row.isOwnTransfer ? findProbableMatch(row, entries) : null;
    const workspaceConflict = hasWorkspaceConflict(suggestedMatch, importContext);
    const reviewGroup =
      row.reviewGroup === "ignored_candidate"
        ? "ignored_candidate"
        : suggestedMatch
          ? "probable_match"
          : row.reviewGroup;
    const suggestedAction =
      row.suggestedAction === "ignore"
        ? "ignore"
        : suggestedMatch && !workspaceConflict
          ? "link_existing"
          : row.suggestedAction;
    const suggestion = selectBankSuggestion(row, learningExamples, suggestedMatch, importContext);

    return {
      id: `${batchId}:${row.lineNumber}`,
      batchId,
      date: row.bookingDate ?? "",
      amount: row.amount,
      currency: row.currency,
      paymentType: row.paymentType,
      rawLabel: row.rawLabel,
      normalizedLabel: row.normalizedLabel,
      entryType: row.entryType,
      reviewGroup,
      suggestedAction,
      selectedAction: null,
      suggestedMatch,
      suggestion,
      isOwnTransfer: row.isOwnTransfer,
      isReserved: row.isReserved
    };
  });
}

export async function getBatchReview(batchId: string, accountId: string) {
  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("bank_import_batches")
    .select("id, default_workspace_id")
    .eq("id", batchId)
    .eq("account_id", accountId)
    .single();

  if (batchError || !batch) {
    throw new Error(batchError?.message || "Could not load bank import batch.");
  }

  let importContext: BankImportContext = {
    defaultWorkspaceId: (batch as BatchRow).default_workspace_id,
    defaultWorkspaceName: null
  };

  if (importContext.defaultWorkspaceId) {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("account_id", accountId)
      .eq("id", importContext.defaultWorkspaceId)
      .maybeSingle();

    if (workspaceError) {
      throw new Error(workspaceError.message);
    }

    importContext = {
      defaultWorkspaceId: importContext.defaultWorkspaceId,
      defaultWorkspaceName: ((workspace ?? null) as WorkspaceRow | null)?.name ?? null
    };
  }

  const { data, error } = await supabase
    .from("bank_transactions")
    .select(
      "id, batch_id, booking_date, amount, currency, payment_type, raw_label, normalized_label, entry_type, review_group, suggested_action, selected_action, suggested_match_score, suggested_entry_id, selected_entry_id, raw_data"
    )
    .eq("batch_id", batchId)
    .eq("account_id", accountId)
    .order("booking_date", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const [entries, learningExamples] = await Promise.all([
    fetchExistingEntryMatches(accountId),
    fetchBankLearningExamples(accountId)
  ]);

  const items = buildStoredReviewItems(
    (data ?? []) as BankTransactionRow[],
    entries,
    learningExamples,
    importContext
  );
  return {
    importContext,
    items,
    summary: summarizeReviewItems(items)
  };
}

export function summarizeParsedRows(items: BankImportReviewItem[]): BankImportReviewSummary {
  return summarizeReviewItems(items);
}
