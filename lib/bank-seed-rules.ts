import type {
  KnownBankRule,
  BankReportingTreatment,
  BankTransactionKind,
  EntryType
} from "@/lib/types";

export type SeededBankRuleMatch = {
  paymentTypes?: string[];
  normalizedIncludes?: string[];
  rawIncludes?: string[];
  entryType?: EntryType;
};

export type SeededBankRule = {
  id: string;
  label: string;
  match: SeededBankRuleMatch;
  transactionKind: BankTransactionKind;
  cat: string;
  confidenceScore: number;
  reviewReason: string;
  reportingTreatment?: BankReportingTreatment;
  autoApply?: boolean;
};

export type BankRuleMatchInput = {
  paymentType: string;
  normalizedLabel: string;
  rawLabel: string;
  entryType: EntryType;
};

export const SEEDED_BANK_RULES: SeededBankRule[] = [
  {
    id: "spotify",
    label: "Spotify subscription",
    match: { normalizedIncludes: ["SPOTIFY"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Abonnementer",
    confidenceScore: 99,
    reviewReason: "Kjent Spotify-trekk behandles som abonnement.",
    autoApply: true
  },
  {
    id: "netflix",
    label: "Netflix subscription",
    match: { normalizedIncludes: ["NETFLIX"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Abonnementer",
    confidenceScore: 99,
    reviewReason: "Kjent Netflix-trekk behandles som abonnement.",
    autoApply: true
  },
  {
    id: "youtube-premium",
    label: "YouTube subscription",
    match: { normalizedIncludes: ["YOUTUBE", "GOOGLE YOUTUBE"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Abonnementer",
    confidenceScore: 98,
    reviewReason: "Kjent YouTube-trekk behandles som abonnement.",
    autoApply: true
  },
  {
    id: "apple-bill",
    label: "Apple recurring charge",
    match: { normalizedIncludes: ["APPLE.COM/BILL", "APPLE"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Abonnementer",
    confidenceScore: 95,
    reviewReason: "Apple-trekk ser ut som abonnement eller fast digital tjeneste.",
    autoApply: true
  },
  {
    id: "openai",
    label: "OpenAI",
    match: { normalizedIncludes: ["OPENAI", "CHATGPT"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent OpenAI/ChatGPT-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "anthropic",
    label: "Anthropic",
    match: { normalizedIncludes: ["ANTHROPIC"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent Anthropic-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "notion",
    label: "Notion",
    match: { normalizedIncludes: ["NOTION"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent Notion-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "github",
    label: "GitHub",
    match: { normalizedIncludes: ["GITHUB"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent GitHub-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "vercel",
    label: "Vercel",
    match: { normalizedIncludes: ["VERCEL"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent Vercel-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "figma",
    label: "Figma",
    match: { normalizedIncludes: ["FIGMA"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent Figma-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "adobe",
    label: "Adobe",
    match: { normalizedIncludes: ["ADOBE"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent Adobe-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "cursor",
    label: "Cursor",
    match: { normalizedIncludes: ["CURSOR", "ANYSPHERE"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Kjent Cursor-trekk behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "linkedin-premium",
    label: "LinkedIn Premium",
    match: { normalizedIncludes: ["LINKEDIN"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 96,
    reviewReason: "LinkedIn Premium behandles som et fast digitalt abonnement.",
    autoApply: true
  },
  {
    id: "icloud",
    label: "Apple iCloud",
    match: { normalizedIncludes: ["ICLOUD", "APPLE"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Abonnementer",
    confidenceScore: 95,
    reviewReason: "Apple iCloud behandles som abonnement.",
    autoApply: true
  },
  {
    id: "claude",
    label: "Claude AI",
    match: { normalizedIncludes: ["CLAUDE", "ANTHROPIC"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 99,
    reviewReason: "Claude/Anthropic behandles som programvareabonnement.",
    autoApply: true
  },
  {
    id: "bookbeat",
    label: "BookBeat",
    match: { normalizedIncludes: ["BOOKBEAT"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Abonnementer",
    confidenceScore: 98,
    reviewReason: "BookBeat behandles som abonnement.",
    autoApply: true
  },
  {
    id: "sit-trening",
    label: "SiT Trening",
    match: {
      normalizedIncludes: ["SIT TRENING", "TRENING", "SITI TRENING", "SIT TRAINING"],
      entryType: "expense"
    },
    transactionKind: "subscription_expense",
    cat: "Annet",
    confidenceScore: 93,
    reviewReason: "SiT Trening behandles som en fast månedlig utgift når treningsmønsteret matcher tydelig.",
    autoApply: true
  },
  {
    id: "rent",
    label: "Rent",
    match: { normalizedIncludes: ["HUSLEIE", "RENT"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Annet",
    confidenceScore: 88,
    reviewReason: "Husleie behandles som fast månedlig utgift når teksten matcher tydelig.",
    autoApply: true
  },
  {
    id: "google-workspace",
    label: "Google",
    match: { normalizedIncludes: ["GOOGLE"], entryType: "expense" },
    transactionKind: "subscription_expense",
    cat: "Programvare & verktøy",
    confidenceScore: 94,
    reviewReason: "Kjent Google-trekk behandles som programvare eller digital tjeneste.",
    autoApply: true
  },
  {
    id: "nordea-salary",
    label: "Salary or fee",
    match: { paymentTypes: ["Lønn"], entryType: "income" },
    transactionKind: "salary_or_fee",
    cat: "Lønn & honorar",
    confidenceScore: 99,
    reviewReason: "Inntekt med betalingstype lønn/honorar klassifiseres direkte.",
    autoApply: true
  },
  {
    id: "invoice-income",
    label: "Invoice income",
    match: { normalizedIncludes: ["FAKTURA", "KID", "INVOICE"], entryType: "income" },
    transactionKind: "invoice_income",
    cat: "Fakturainntekter",
    confidenceScore: 96,
    reviewReason: "Teksten ligner fakturainnbetaling og klassifiseres aggressivt.",
    autoApply: true
  },
  {
    id: "invoice-expense",
    label: "Invoice expense",
    match: { normalizedIncludes: ["FAKTURA", "KID", "INVOICE"], entryType: "expense" },
    transactionKind: "invoice_expense",
    cat: "Annet",
    confidenceScore: 90,
    reviewReason: "Teksten ligner fakturautbetaling.",
    autoApply: true
  }
];

function includesAny(target: string, candidates: string[] | undefined) {
  if (!candidates || candidates.length === 0) {
    return true;
  }

  return candidates.some((candidate) => target.includes(candidate.toUpperCase()));
}

export function findMatchingSeededBankRule(rules: SeededBankRule[], args: BankRuleMatchInput) {
  const normalizedPaymentType = args.paymentType.trim().toUpperCase();
  const normalizedRawLabel = args.rawLabel.toUpperCase();

  return (
    rules.find((rule) => {
      if (rule.match.entryType && rule.match.entryType !== args.entryType) {
        return false;
      }

      if (
        rule.match.paymentTypes &&
        !rule.match.paymentTypes.some((paymentType) => paymentType.toUpperCase() === normalizedPaymentType)
      ) {
        return false;
      }

      if (!includesAny(args.normalizedLabel, rule.match.normalizedIncludes)) {
        return false;
      }

      if (!includesAny(normalizedRawLabel, rule.match.rawIncludes)) {
        return false;
      }

      return Boolean(
        rule.match.paymentTypes?.length ||
          rule.match.normalizedIncludes?.length ||
          rule.match.rawIncludes?.length
      );
    }) ?? null
  );
}

export function findSeededBankRule(args: BankRuleMatchInput) {
  return findMatchingSeededBankRule(SEEDED_BANK_RULES, args);
}

export function findKnownBankRule(rules: KnownBankRule[], args: BankRuleMatchInput) {
  const normalizedPaymentType = args.paymentType.trim().toUpperCase();
  return (
    rules.find((rule) => {
      if (rule.entryType && rule.entryType !== args.entryType) {
        return false;
      }

      if (rule.paymentType && rule.paymentType.trim().toUpperCase() !== normalizedPaymentType) {
        return false;
      }

      if (!includesAny(args.normalizedLabel, rule.normalizedIncludes)) {
        return false;
      }

      return rule.normalizedIncludes.length > 0 || Boolean(rule.paymentType);
    }) ?? null
  );
}
