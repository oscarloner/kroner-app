import {
  classifyAutoApplyCandidate,
  findProbableMatch,
  selectBankSuggestion,
  suggestRelatedTransactionLinks,
  summarizeReviewItems,
  type AutoApplyCandidate,
  type BankLearningExample,
  type ExistingEntryMatch,
  type LinkableBankTransaction,
  type ParsedNordeaTransaction
} from "@/lib/bank-import";
import { createClient } from "@/lib/supabase/server";
import type {
  BankClassificationSource,
  BankImportContext,
  BankImportReviewItem,
  BankImportReviewSummary,
  BankMatchCandidate,
  BankReportingTreatment,
  BankTransactionKind,
  BankTransactionLinkStatus,
  BankTransactionLinkSuggestion,
  KnownBankRule,
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
  transaction_kind: BankTransactionKind;
  confidence_score: number;
  classification_source: BankClassificationSource | null;
  review_reason: string | null;
  reporting_treatment: BankReportingTreatment;
  suggested_match_score: number;
  suggested_entry_id: string | null;
  selected_entry_id: string | null;
  applied_entry_id?: string | null;
  raw_data: { isOwnTransfer?: boolean; isReserved?: boolean };
  status?: "pending" | "applied" | "ignored" | "transfer" | "linked";
};

type LearningRow = {
  normalized_label: string;
  raw_label: string;
  payment_type: string;
  entry_type: EntryType;
  cat: string;
  workspace_id: string | null;
  source_workspace_id: string | null;
  transaction_kind: BankTransactionKind | null;
  reporting_treatment: BankReportingTreatment | null;
  usage_count: number;
};

type TransactionLinkRow = {
  id: string;
  left_bank_transaction_id: string;
  right_bank_transaction_id: string;
  link_kind: "vipps_offset" | "transfer_pair";
  confidence_score: number;
  status: BankTransactionLinkStatus;
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
    .select("normalized_label, raw_label, payment_type, entry_type, cat, workspace_id, source_workspace_id, transaction_kind, reporting_treatment, usage_count")
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
    sourceWorkspaceId: example.source_workspace_id,
    transactionKind: example.transaction_kind,
    reportingTreatment: example.reporting_treatment,
    usageCount: example.usage_count
  }));
}

type KnownRuleRow = {
  id: string;
  account_id: string;
  created_by: string;
  label: string;
  normalized_includes: string[] | null;
  payment_type: string | null;
  entry_type: EntryType | null;
  transaction_kind: BankTransactionKind;
  cat: string;
  workspace_id: string | null;
  confidence_score: number;
  reporting_treatment: BankReportingTreatment;
  auto_apply: boolean;
  created_at: string;
};

export async function fetchKnownBankRules(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_known_rules")
    .select(
      "id, account_id, created_by, label, normalized_includes, payment_type, entry_type, transaction_kind, cat, workspace_id, confidence_score, reporting_treatment, auto_apply, created_at"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as KnownRuleRow[]).map<KnownBankRule>((rule) => ({
    id: rule.id,
    accountId: rule.account_id,
    createdBy: rule.created_by,
    label: rule.label,
    normalizedIncludes: rule.normalized_includes ?? [],
    paymentType: rule.payment_type,
    entryType: rule.entry_type,
    transactionKind: rule.transaction_kind,
    cat: rule.cat,
    workspaceId: rule.workspace_id,
    confidenceScore: rule.confidence_score,
    reportingTreatment: rule.reporting_treatment,
    autoApply: rule.auto_apply,
    createdAt: rule.created_at
  }));
}

function toLinkSuggestions(
  row: BankTransactionRow,
  links: TransactionLinkRow[],
  rowsById: Map<string, BankTransactionRow>
) {
  const suggestions: BankTransactionLinkSuggestion[] = [];

  for (const link of links) {
    const otherId =
      link.left_bank_transaction_id === row.id
        ? link.right_bank_transaction_id
        : link.right_bank_transaction_id === row.id
          ? link.left_bank_transaction_id
          : null;

    if (!otherId) {
      continue;
    }

    const other = rowsById.get(otherId);
    if (!other) {
      continue;
    }

    suggestions.push({
      id: link.id,
      otherTransactionId: otherId,
      otherRawLabel: other.raw_label,
      otherPaymentType: other.payment_type,
      otherAmount: Number(other.amount),
      otherEntryType: other.entry_type,
      linkKind: link.link_kind,
      confidenceScore: link.confidence_score,
      status: link.status
    });
  }

  return suggestions;
}

export function buildStoredReviewItems(
  rows: BankTransactionRow[],
  entries: ExistingEntryMatch[],
  learningExamples: BankLearningExample[],
  knownRules: KnownBankRule[],
  links: TransactionLinkRow[],
  importContext?: BankImportContext
) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
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
            transactionKind: row.transaction_kind,
            confidenceScore: row.confidence_score,
            classificationSource: row.classification_source ?? "rule",
            reviewReason: row.review_reason ?? "",
            reportingTreatment: row.reporting_treatment,
            rawData: {}
          },
          entries.filter((entry) => entry.id === row.suggested_entry_id)
        )
      : null;

    const suggestion = selectBankSuggestion(
      {
        rawLabel: row.raw_label,
        normalizedLabel: row.normalized_label,
        paymentType: row.payment_type,
        entryType: row.entry_type
      },
      learningExamples,
      knownRules,
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
      transactionKind: row.transaction_kind,
      confidenceScore: row.confidence_score,
      classificationSource: row.classification_source ?? "rule",
      reviewReason: row.review_reason ?? "",
      reportingTreatment: row.reporting_treatment,
      linkSuggestions: toLinkSuggestions(row, links, rowsById),
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
  knownRules: KnownBankRule[],
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
    const suggestion = selectBankSuggestion(row, learningExamples, knownRules, suggestedMatch, importContext);

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
      transactionKind: suggestion?.transactionKind ?? row.transactionKind,
      confidenceScore: Math.max(row.confidenceScore, suggestion?.confidenceScore ?? 0),
      classificationSource: suggestion?.classificationSource ?? row.classificationSource,
      reviewReason: suggestion?.reviewReason ?? row.reviewReason,
      reportingTreatment: suggestion?.reportingTreatment ?? row.reportingTreatment,
      linkSuggestions: [],
      isOwnTransfer: row.isOwnTransfer,
      isReserved: row.isReserved
    };
  });
}

export function buildSuggestedTransactionLinks(rows: BankTransactionRow[]) {
  return suggestRelatedTransactionLinks(
    rows.map<LinkableBankTransaction>((row) => ({
      id: row.id,
      bookingDate: row.booking_date,
      amount: Number(row.amount),
      paymentType: row.payment_type,
      rawLabel: row.raw_label,
      normalizedLabel: row.normalized_label,
      entryType: row.entry_type,
      transactionKind: row.transaction_kind
    }))
  );
}

export function splitParsedReviewItems(
  items: BankImportReviewItem[],
  importContext?: BankImportContext
) {
  const autoApply: AutoApplyCandidate[] = [];
  const needsReview: BankImportReviewItem[] = [];

  for (const item of items) {
    const candidate = classifyAutoApplyCandidate(item, importContext);
    if (candidate) {
      autoApply.push(candidate);
      continue;
    }

    needsReview.push(item);
  }

  return {
    autoApply,
    needsReview
  };
}

function summarizeStoredRows(rows: BankTransactionRow[]): BankImportReviewSummary {
  return rows.reduce<BankImportReviewSummary>(
    (summary, row) => {
      summary.total += 1;

      if (row.status === "applied" || row.status === "linked") {
        summary.autoAppliedCount += 1;
      } else if (row.status === "ignored") {
        summary.ignoredCount += 1;
      } else {
        summary.reviewCount += 1;
        if (row.review_group === "probable_match") {
          summary.probableMatchCount += 1;
        }
      }

      return summary;
    },
    {
      total: 0,
      autoAppliedCount: 0,
      reviewCount: 0,
      probableMatchCount: 0,
      ignoredCount: 0,
      batchCompleted: false
    }
  );
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
      "id, batch_id, booking_date, amount, currency, payment_type, raw_label, normalized_label, entry_type, review_group, suggested_action, selected_action, transaction_kind, confidence_score, classification_source, review_reason, reporting_treatment, suggested_match_score, suggested_entry_id, selected_entry_id, applied_entry_id, raw_data, status"
    )
    .eq("batch_id", batchId)
    .eq("account_id", accountId)
    .order("booking_date", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const { data: linkRows, error: linkError } = await supabase
    .from("transaction_links")
    .select(
      "id, left_bank_transaction_id, right_bank_transaction_id, link_kind, confidence_score, status"
    )
    .eq("batch_id", batchId)
    .eq("account_id", accountId);

  if (linkError) {
    throw new Error(linkError.message);
  }

  const [entries, learningExamples, knownRules] = await Promise.all([
    fetchExistingEntryMatches(accountId),
    fetchBankLearningExamples(accountId),
    fetchKnownBankRules(accountId)
  ]);

  const rows = (data ?? []) as BankTransactionRow[];
  const items = buildStoredReviewItems(
    rows.filter((row) => row.status === "pending"),
    entries,
    learningExamples,
    knownRules,
    (linkRows ?? []) as TransactionLinkRow[],
    importContext
  );
  const summary = summarizeStoredRows(rows);
  return {
    importContext,
    items,
    summary: {
      ...summary,
      batchCompleted: summary.reviewCount === 0
    }
  };
}

export function summarizeParsedRows(items: BankImportReviewItem[]): BankImportReviewSummary {
  const summary = summarizeReviewItems(items);
  return {
    ...summary,
    batchCompleted: summary.reviewCount === 0
  };
}
