import type {
  BankImportAction,
  BankClassificationSource,
  BankImportContext,
  BankImportReviewGroup,
  BankImportReviewItem,
  BankImportReviewSummary,
  BankReportingTreatment,
  BankTransactionKind,
  BankTransactionLinkKind,
  BankMatchCandidate,
  BankSuggestion,
  KnownBankRule,
  EntryType
} from "@/lib/types";
import { findKnownBankRule, findSeededBankRule } from "@/lib/bank-seed-rules";

type ParsedCsvRow = Record<string, string>;

export type ParsedNordeaTransaction = {
  lineNumber: number;
  bookingDate: string | null;
  rawBookingDate: string;
  amount: number;
  currency: string;
  paymentType: string;
  sender: string | null;
  receiver: string | null;
  title: string | null;
  name: string | null;
  rawLabel: string;
  normalizedLabel: string;
  entryType: EntryType;
  sourceFingerprint: string;
  isReserved: boolean;
  isOwnTransfer: boolean;
  reviewGroup: BankImportReviewGroup;
  suggestedAction: BankImportAction;
  transactionKind: BankTransactionKind;
  confidenceScore: number;
  classificationSource: BankClassificationSource;
  reviewReason: string;
  reportingTreatment: BankReportingTreatment;
  rawData: ParsedCsvRow;
};

export type ExistingEntryMatch = {
  id: string;
  name: string;
  rawName: string | null;
  amount: number;
  type: EntryType;
  cat: string;
  workspaceId: string | null;
  date: string;
  sourceFingerprint: string | null;
  paymentType: string | null;
};

export type BankLearningExample = {
  normalizedLabel: string;
  rawLabel: string;
  paymentType: string;
  type: EntryType;
  cat: string;
  workspaceId: string | null;
  sourceWorkspaceId: string | null;
  transactionKind?: BankTransactionKind | null;
  reportingTreatment?: BankReportingTreatment | null;
  usageCount: number;
};

export type LinkableBankTransaction = {
  id: string;
  bookingDate: string | null;
  amount: number;
  paymentType: string;
  rawLabel: string;
  normalizedLabel: string;
  entryType: EntryType;
  transactionKind: BankTransactionKind;
};

export type AutoApplyCandidate = {
  item: BankImportReviewItem;
  action: "import_new" | "ignore";
  reason: "safe_suggestion" | "safe_applaus_income" | "ignored_candidate";
};

function normalizeWorkspaceName(value: string | null | undefined) {
  return normalizeNordeaLabel(value ?? "");
}

function isInvoiceIncomeWorkspace(value: string | null | undefined) {
  return normalizeWorkspaceName(value).includes("APPLAUS CREATIVE");
}

const OWN_TRANSFER_NAMES = ["OSCAR LONE OLSEN"];
const PERSON_REVIEW_PAYMENT_TYPES = new Set([
  "Kontoregulering",
  "Straksinnbetaling",
  "Straksutbetaling"
]);
const TRANSFER_PAYMENT_TYPES = new Set(["Kontoregulering", "Straksinnbetaling", "Straksutbetaling"]);
const KNOWN_REVIEW_LABELS = [
  "VIPPS",
  "TYVEN",
  "MELLOM",
  "SNURR",
  "SJAKK MATT",
  "STUDENTERSAMFUNDET",
  "BUCKAROO"
];
const REVIEW_KEYWORDS = [" TIL ", " FRA ", "VIPPS"];
const SAFE_AUTO_IMPORT_PAYMENT_TYPES = new Set(["Visa varekjøp/uttak", "Avtalegiro", "Lønn"]);
const SUBSCRIPTION_PAYMENT_TYPES = new Set(["Avtalegiro"]);
const INVOICE_KEYWORDS = ["FAKTURA", "KID", "INVOICE"];
const SALARY_PAYMENT_TYPES = new Set(["Lønn"]);

function csvLineToCells(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }

      quoted = !quoted;
      continue;
    }

    if (char === ";" && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

export function parseDelimitedCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = csvLineToCells(lines[0]).map((value) => value.trim());

  return lines.slice(1).map((line) => {
    const values = csvLineToCells(line);
    return headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = values[index]?.trim() ?? "";
      return accumulator;
    }, {});
  });
}

export function parseNordeaAmount(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid Nordea amount: ${value}`);
  }

  return amount;
}

export function parseNordeaDate(value: string) {
  const trimmed = value.trim();

  if (!trimmed || trimmed.toLowerCase() === "reservert") {
    return null;
  }

  const match = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function stripLocationNoise(value: string) {
  return value
    .replace(/\s+[A-ZÆØÅ][A-ZÆØÅ\s]{2,}\s+(NO|US|SE|DK|GB)\b/g, " ")
    .replace(/\s+[A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)*\s+(NO|US|SE|DK|GB)\b/g, " ")
    .replace(/\+\d{6,}/g, " ");
}

export function normalizeNordeaLabel(value: string) {
  return stripLocationNoise(value.toUpperCase())
    .replace(/^VIPPS\*/g, "VIPPS ")
    .replace(/[,*]/g, " ")
    .replace(/\b[A-Z0-9]{6,}\b/g, " ")
    .replace(/\bP\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isVippsTransaction(paymentType: string, normalizedLabel: string, rawLabel: string) {
  return (
    paymentType.toLowerCase().includes("vipps") ||
    normalizedLabel.includes("VIPPS") ||
    rawLabel.toUpperCase().includes("VIPPS")
  );
}

function isSubscriptionCandidate(paymentType: string, normalizedLabel: string, entryType: EntryType) {
  return (
    entryType === "expense" &&
    (SUBSCRIPTION_PAYMENT_TYPES.has(paymentType) ||
      normalizedLabel.includes("SPOTIFY") ||
      normalizedLabel.includes("NETFLIX") ||
      normalizedLabel.includes("APPLE.COM/BILL") ||
      normalizedLabel.includes("GOOGLE") ||
      normalizedLabel.includes("ADOBE"))
  );
}

function isInvoiceCandidate(normalizedLabel: string) {
  return INVOICE_KEYWORDS.some((keyword) => normalizedLabel.includes(keyword));
}

function classifyParsedTransaction(args: {
  paymentType: string;
  normalizedLabel: string;
  rawLabel: string;
  entryType: EntryType;
  isOwnTransfer: boolean;
  likelyTransfer: boolean;
  isReserved: boolean;
  knownRules?: KnownBankRule[];
}): {
  transactionKind: BankTransactionKind;
  confidenceScore: number;
  classificationSource: BankClassificationSource;
  reviewReason: string;
  reportingTreatment: BankReportingTreatment;
} {
  const knownRule = args.knownRules ? findKnownBankRule(args.knownRules, args) : null;
  if (knownRule) {
    return {
      transactionKind: knownRule.transactionKind,
      confidenceScore: knownRule.confidenceScore,
      classificationSource: "rule",
      reviewReason: `Kjent regel: ${knownRule.label}.`,
      reportingTreatment: knownRule.reportingTreatment
    };
  }

  const seededRule = findSeededBankRule(args);
  if (seededRule) {
    return {
      transactionKind: seededRule.transactionKind,
      confidenceScore: seededRule.confidenceScore,
      classificationSource: "rule",
      reviewReason: seededRule.reviewReason,
      reportingTreatment: seededRule.reportingTreatment ?? "normal"
    };
  }

  if (args.isReserved) {
    return {
      transactionKind: "other" as BankTransactionKind,
      confidenceScore: 100,
      classificationSource: "rule" as BankClassificationSource,
      reviewReason: "Reservert post uten bokføringsdato.",
      reportingTreatment: "normal" as BankReportingTreatment
    };
  }

  if (args.isOwnTransfer || args.likelyTransfer) {
    return {
      transactionKind: "bank_transfer" as BankTransactionKind,
      confidenceScore: args.isOwnTransfer ? 98 : 88,
      classificationSource: "rule" as BankClassificationSource,
      reviewReason: "Betalingstype og tekst ser ut som overføring mellom kontoer eller personer.",
      reportingTreatment: "normal" as BankReportingTreatment
    };
  }

  if (isVippsTransaction(args.paymentType, args.normalizedLabel, args.rawLabel)) {
    return {
      transactionKind: "vipps" as BankTransactionKind,
      confidenceScore: 94,
      classificationSource: "rule" as BankClassificationSource,
      reviewReason: "Vipps ble funnet i betalingstype eller tekst.",
      reportingTreatment: "normal" as BankReportingTreatment
    };
  }

  if (isSubscriptionCandidate(args.paymentType, args.normalizedLabel, args.entryType)) {
    return {
      transactionKind: args.entryType === "income" ? "subscription_income" : "subscription_expense",
      confidenceScore: 86,
      classificationSource: "rule" as BankClassificationSource,
      reviewReason: "Betalingstype eller kjent tjeneste ligner et gjentakende abonnement.",
      reportingTreatment: "normal" as BankReportingTreatment
    };
  }

  if (SALARY_PAYMENT_TYPES.has(args.paymentType)) {
    return {
      transactionKind: "salary_or_fee" as BankTransactionKind,
      confidenceScore: 90,
      classificationSource: "rule" as BankClassificationSource,
      reviewReason: "Betalingstype er registrert som lønn/honorar.",
      reportingTreatment: "normal" as BankReportingTreatment
    };
  }

  if (isInvoiceCandidate(args.normalizedLabel)) {
    return {
      transactionKind: args.entryType === "income" ? "invoice_income" : "invoice_expense",
      confidenceScore: 84,
      classificationSource: "rule" as BankClassificationSource,
      reviewReason: "Teksten inneholder fakturasignaler som KID eller faktura.",
      reportingTreatment: "normal" as BankReportingTreatment
    };
  }

  return {
    transactionKind: (args.entryType === "expense" ? "card_purchase" : "other") as BankTransactionKind,
    confidenceScore: args.entryType === "expense" ? 72 : 60,
    classificationSource: "rule" as BankClassificationSource,
    reviewReason:
      args.entryType === "expense"
        ? "Standardkjøp uten sterke signaler, behandles som vanlig kortkjøp."
        : "Ingen tydelige signaler, beholdes som annen inntekt.",
    reportingTreatment: "normal" as BankReportingTreatment
  };
}

function pickRawLabel(row: ParsedCsvRow) {
  return row["Navn"] || row["Tittel"] || row["Mottaker"] || row["Avsender"] || "";
}

function isOwnTransferLabel(label: string) {
  return OWN_TRANSFER_NAMES.some((name) => label.includes(name));
}

function isLikelyTransfer(rawLabel: string, normalizedLabel: string, paymentType: string) {
  if (TRANSFER_PAYMENT_TYPES.has(paymentType)) {
    return true;
  }

  if (REVIEW_KEYWORDS.some((keyword) => ` ${normalizedLabel} `.includes(keyword))) {
    return true;
  }

  return normalizedLabel.startsWith("TIL ") || normalizedLabel.startsWith("FRA ");
}

function requiresManualReview(rawLabel: string, normalizedLabel: string, paymentType: string) {
  if (PERSON_REVIEW_PAYMENT_TYPES.has(paymentType)) {
    return true;
  }

  if (KNOWN_REVIEW_LABELS.some((token) => normalizedLabel.includes(token))) {
    return true;
  }

  return /^(TIL|FRA)\s/.test(normalizedLabel) || rawLabel.includes("VIPPS");
}

export function buildNordeaFingerprint(transaction: {
  bookingDate: string | null;
  amount: number;
  normalizedLabel: string;
  paymentType: string;
}) {
  return [
    transaction.bookingDate ?? "pending",
    transaction.amount.toFixed(2),
    transaction.normalizedLabel,
    transaction.paymentType.trim().toUpperCase()
  ].join("|");
}

export function parseNordeaCsv(text: string) {
  return parseDelimitedCsv(text).map<ParsedNordeaTransaction>((row, index) => {
    const rawBookingDate = row["Bokføringsdato"] ?? "";
    const bookingDate = parseNordeaDate(rawBookingDate);
    const amount = parseNordeaAmount(row["Beløp"] ?? "");
    const paymentType = row["Betalingstype"] ?? "";
    const rawLabel = pickRawLabel(row).trim();
    const normalizedLabel = normalizeNordeaLabel(rawLabel);
    const isReserved = bookingDate === null;
    const isOwnTransfer = isOwnTransferLabel(normalizedLabel);
    const likelyTransfer = isLikelyTransfer(rawLabel, normalizedLabel, paymentType);
    const reviewRequired = requiresManualReview(rawLabel, normalizedLabel, paymentType);
    const classification = classifyParsedTransaction({
      paymentType,
      normalizedLabel,
      rawLabel,
      entryType: amount < 0 ? "expense" : "income",
      isOwnTransfer,
      likelyTransfer,
      isReserved
    });
    const reviewGroup: BankImportReviewGroup = isReserved || isOwnTransfer
      ? "ignored_candidate"
      : likelyTransfer || reviewRequired
        ? "transfer"
        : "new";

    const suggestedAction: BankImportAction = isReserved || isOwnTransfer
      ? "ignore"
      : likelyTransfer || reviewRequired
        ? "mark_transfer"
        : "import_new";

    return {
      lineNumber: index + 2,
      bookingDate,
      rawBookingDate,
      amount: Math.abs(amount),
      currency: row["Valuta"] || "NOK",
      paymentType,
      sender: row["Avsender"] || null,
      receiver: row["Mottaker"] || null,
      title: row["Tittel"] || null,
      name: row["Navn"] || null,
      rawLabel,
      normalizedLabel,
      entryType: amount < 0 ? "expense" : "income",
      sourceFingerprint: buildNordeaFingerprint({
        bookingDate,
        amount: Math.abs(amount),
        normalizedLabel,
        paymentType
      }),
      isReserved,
      isOwnTransfer,
      reviewGroup,
      suggestedAction,
      transactionKind: classification.transactionKind,
      confidenceScore: classification.confidenceScore,
      classificationSource: classification.classificationSource,
      reviewReason: classification.reviewReason,
      reportingTreatment: classification.reportingTreatment,
      rawData: row
    };
  });
}

function tokenOverlapScore(left: string, right: string) {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 1));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 1));
  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function scoreNormalizedLabels(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 100;
  }

  if (left.includes(right) || right.includes(left)) {
    return 80;
  }

  return Math.min(70, tokenOverlapScore(left, right) * 20);
}

function dayDistance(left: string, right: string) {
  const distance = Math.abs(new Date(left).getTime() - new Date(right).getTime());
  return Math.round(distance / 86400000);
}

export function findProbableMatch(
  transaction: ParsedNordeaTransaction,
  entries: ExistingEntryMatch[]
): BankMatchCandidate | null {
  let bestMatch: BankMatchCandidate | null = null;

  for (const entry of entries) {
    if (entry.type !== transaction.entryType) {
      continue;
    }

    if (Math.abs(entry.amount - transaction.amount) > 0.001) {
      continue;
    }

    if (entry.sourceFingerprint && entry.sourceFingerprint === transaction.sourceFingerprint) {
      return {
        entryId: entry.id,
        entryName: entry.name,
        score: 100,
        cat: entry.cat,
        workspaceId: entry.workspaceId,
        type: entry.type
      };
    }

    const daysApart = dayDistance(entry.date, transaction.bookingDate ?? entry.date);
    if (daysApart > 4) {
      continue;
    }

    const entryLabel = normalizeNordeaLabel(entry.rawName || entry.name);
    const labelScore = scoreNormalizedLabels(transaction.normalizedLabel, entryLabel);
    const dateScore = Math.max(0, 20 - daysApart * 5);
    const totalScore = Math.min(99, labelScore + dateScore);

    if (!bestMatch || totalScore > bestMatch.score) {
      bestMatch = {
        entryId: entry.id,
        entryName: entry.name,
        score: totalScore,
        cat: entry.cat,
        workspaceId: entry.workspaceId,
        type: entry.type
      };
    }
  }

  if (!bestMatch || bestMatch.score < 60) {
    return null;
  }

  return bestMatch;
}

export function selectBankSuggestion(
  transaction: Pick<ParsedNordeaTransaction, "normalizedLabel" | "paymentType" | "entryType"> & {
    rawLabel?: string;
  },
  learningExamples: BankLearningExample[],
  knownRules: KnownBankRule[] = [],
  fallbackMatch?: BankMatchCandidate | null,
  importContext?: BankImportContext
): BankSuggestion | null {
  const knownRule = findKnownBankRule(knownRules, {
    paymentType: transaction.paymentType,
    normalizedLabel: transaction.normalizedLabel,
    rawLabel: transaction.rawLabel ?? transaction.normalizedLabel,
    entryType: transaction.entryType
  });

  if (knownRule) {
    return {
      type: knownRule.entryType ?? transaction.entryType,
      cat: knownRule.cat,
      workspaceId: knownRule.workspaceId ?? importContext?.defaultWorkspaceId ?? null,
      transactionKind: knownRule.transactionKind,
      confidenceScore: knownRule.confidenceScore,
      classificationSource: "rule",
      reviewReason: `Kjent regel: ${knownRule.label}.`,
      reportingTreatment: knownRule.reportingTreatment
    };
  }

  const seededRule = findSeededBankRule({
    paymentType: transaction.paymentType,
    normalizedLabel: transaction.normalizedLabel,
    rawLabel: transaction.rawLabel ?? transaction.normalizedLabel,
    entryType: transaction.entryType
  });

  if (seededRule) {
    return {
      type: transaction.entryType,
      cat: seededRule.cat,
      workspaceId: importContext?.defaultWorkspaceId ?? null,
      transactionKind: seededRule.transactionKind,
      confidenceScore: seededRule.confidenceScore,
      classificationSource: "rule",
      reviewReason: seededRule.reviewReason,
      reportingTreatment: seededRule.reportingTreatment ?? "normal"
    };
  }

  let bestScore = 0;
  let bestSuggestion: BankSuggestion | null = null;

  for (const example of learningExamples) {
    if (example.type !== transaction.entryType) {
      continue;
    }

    const paymentTypeBonus =
      example.paymentType.trim().toUpperCase() === transaction.paymentType.trim().toUpperCase() ? 20 : 0;
    const sourceWorkspaceBonus =
      importContext?.defaultWorkspaceId && example.sourceWorkspaceId === importContext.defaultWorkspaceId
        ? 25
        : 0;
    const score =
      scoreNormalizedLabels(transaction.normalizedLabel, example.normalizedLabel) +
      paymentTypeBonus +
      sourceWorkspaceBonus +
      Math.min(15, example.usageCount * 3);

    if (score > bestScore) {
      bestScore = score;
      bestSuggestion = {
        type: example.type,
        cat: example.cat,
        workspaceId: example.workspaceId,
        transactionKind: example.transactionKind ?? (example.type === "income" ? "other" : "card_purchase"),
        confidenceScore: clampScore(score),
        classificationSource: "history",
        reviewReason: `Matcher tidligere bekreftet banktransaksjon${example.usageCount > 1 ? ` (${example.usageCount} ganger)` : ""}.`,
        reportingTreatment: example.reportingTreatment ?? "normal"
      };
    }
  }

  if (bestSuggestion && bestScore >= 70) {
    if (importContext?.defaultWorkspaceId) {
      return {
        ...bestSuggestion,
        workspaceId: importContext.defaultWorkspaceId
      };
    }

    return bestSuggestion;
  }

  if (importContext?.defaultWorkspaceId && isInvoiceIncomeWorkspace(importContext.defaultWorkspaceName)) {
    if (transaction.entryType === "income") {
      return {
        type: "income",
        cat: "Fakturainntekter",
        workspaceId: importContext.defaultWorkspaceId,
        transactionKind: "invoice_income",
        confidenceScore: 82,
        classificationSource: "rule",
        reviewReason: "Inntekt i fakturaprosjekt foreslås som fakturainnbetaling.",
        reportingTreatment: "normal"
      };
    }
  }

  if (fallbackMatch) {
    return {
      type: fallbackMatch.type,
      cat: fallbackMatch.cat,
      workspaceId: importContext?.defaultWorkspaceId ?? fallbackMatch.workspaceId,
      transactionKind: fallbackMatch.type === "income" ? "other" : "card_purchase",
      confidenceScore: 78,
      classificationSource: "match",
      reviewReason: "Matcher eksisterende transaksjon med samme beløp og lignende tekst.",
      reportingTreatment: "normal"
    };
  }

  if (importContext?.defaultWorkspaceId) {
    return {
      type: transaction.entryType,
      cat: "Annet",
      workspaceId: importContext.defaultWorkspaceId,
      transactionKind: transaction.entryType === "expense" ? "card_purchase" : "other",
      confidenceScore: 55,
      classificationSource: "rule",
      reviewReason: "Mangler sterk historikk, bruker standardforslag i valgt prosjekt.",
      reportingTreatment: "normal"
    };
  }

  return null;
}

export function classifyAutoApplyCandidate(
  item: BankImportReviewItem,
  importContext?: BankImportContext
): AutoApplyCandidate | null {
  if (item.isReserved || item.isOwnTransfer || item.suggestedAction === "ignore") {
    return {
      item,
      action: "ignore",
      reason: "ignored_candidate"
    };
  }

  if (item.suggestedMatch) {
    return null;
  }

  if (item.reviewGroup !== "new" || item.suggestedAction !== "import_new") {
    return null;
  }

  if (!item.suggestion?.workspaceId) {
    return null;
  }

  if (
    importContext?.defaultWorkspaceId &&
    item.suggestion.workspaceId !== importContext.defaultWorkspaceId
  ) {
    return null;
  }

  if (
    item.entryType === "income" &&
    isInvoiceIncomeWorkspace(importContext?.defaultWorkspaceName) &&
    item.suggestion.cat === "Fakturainntekter"
  ) {
    return {
      item,
      action: "import_new",
      reason: "safe_applaus_income"
    };
  }

  if (
    item.suggestion?.classificationSource === "rule" &&
    item.suggestion.confidenceScore >= 90 &&
    item.suggestedAction === "import_new"
  ) {
    return {
      item,
      action: "import_new",
      reason: "safe_suggestion"
    };
  }

  if (SAFE_AUTO_IMPORT_PAYMENT_TYPES.has(item.paymentType) && item.confidenceScore >= 85) {
    return {
      item,
      action: "import_new",
      reason: "safe_suggestion"
    };
  }

  return null;
}

function looksLikeVippsOffsetCandidate(transaction: LinkableBankTransaction) {
  return transaction.transactionKind === "vipps";
}

function looksLikeTransferOffsetCandidate(transaction: LinkableBankTransaction) {
  return transaction.transactionKind === "bank_transfer";
}

export function suggestRelatedTransactionLinks(transactions: LinkableBankTransaction[]) {
  const links: Array<{
    leftTransactionId: string;
    rightTransactionId: string;
    linkKind: BankTransactionLinkKind;
    confidenceScore: number;
    reviewReason: string;
  }> = [];
  const seen = new Set<string>();

  for (const left of transactions) {
    if (!looksLikeVippsOffsetCandidate(left)) {
      continue;
    }

    for (const right of transactions) {
      if (left.id === right.id || !looksLikeTransferOffsetCandidate(right)) {
        continue;
      }

      if (left.entryType === right.entryType) {
        continue;
      }

      const amountDistance = Math.abs(left.amount - right.amount);
      if (amountDistance > 0.001) {
        continue;
      }

      const daysApart = dayDistance(left.bookingDate ?? "", right.bookingDate ?? "");
      if (!Number.isFinite(daysApart) || daysApart > 5) {
        continue;
      }

      const textScore = Math.max(
        scoreNormalizedLabels(left.normalizedLabel, right.normalizedLabel),
        left.rawLabel.toUpperCase().includes("VIPPS") || right.rawLabel.toUpperCase().includes("VIPPS") ? 35 : 0
      );
      const confidenceScore = clampScore(55 + textScore / 2 + Math.max(0, 20 - daysApart * 4));
      if (confidenceScore < 80) {
        continue;
      }

      const key = [left.id, right.id].sort().join("|");
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      links.push({
        leftTransactionId: left.id,
        rightTransactionId: right.id,
        linkKind: "vipps_offset",
        confidenceScore,
        reviewReason: "Vipps-post og overføring har samme beløp og tett timing, og ser ut som mellomledd."
      });
    }
  }

  return links;
}

export function summarizeReviewItems(items: BankImportReviewItem[]): BankImportReviewSummary {
  return items.reduce<BankImportReviewSummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.reviewGroup === "probable_match") summary.probableMatchCount += 1;
      summary.reviewCount += 1;
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
