export const MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember"
] as const;

export const CATEGORIES = [
  "Fakturainntekter",
  "Lønn & honorar",
  "Stipend",
  "Utbytte",
  "Programvare & verktøy",
  "Mat & drikke",
  "Transport",
  "Utstyr & hardware",
  "Abonnementer",
  "Annet"
] as const;

export type EntryType = "income" | "expense";
export type RecurringType = "sub" | "fixed";
export type AccountRole = "owner" | "admin" | "member";

export type AppAccount = {
  id: string;
  slug: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type AccountMember = {
  accountId: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: AccountRole;
  createdAt: string;
};

export type Workspace = {
  id: string;
  accountId: string;
  createdBy: string;
  legacyId: string | null;
  name: string;
  color: string;
};

export type Entry = {
  id: string;
  accountId: string;
  createdBy: string;
  legacyId: string | null;
  name: string;
  amount: number;
  type: EntryType;
  cat: string;
  workspaceId: string | null;
  date: string;
  link: string | null;
  note: string | null;
  sourceType?: "manual" | "nordea_csv" | null;
  sourceName?: string | null;
  sourceTransactionId?: string | null;
  sourceFingerprint?: string | null;
  rawName?: string | null;
  paymentType?: string | null;
  importBatchId?: string | null;
  matchStatus?: "manual" | "linked" | "imported" | "ignored" | "transfer" | null;
  sourceKind?: "entry" | "recurring";
  recurringType?: RecurringType | null;
  projectedFromRecurringId?: string | null;
  isProjected?: boolean;
  createdAt: string;
};

export type RecurringItem = {
  id: string;
  accountId: string;
  createdBy: string;
  legacyId: string | null;
  name: string;
  amount: number;
  type: RecurringType;
  cat: string;
  workspaceId: string | null;
  link: string | null;
  dayOfMonth: number;
  createdAt: string;
};

export type DashboardData = {
  userEmail: string;
  accounts: AppAccount[];
  currentAccount: AppAccount;
  currentRole: AccountRole;
  members: AccountMember[];
  workspaces: Workspace[];
  currentWorkspaceId: string;
  currentWorkspace: Workspace | null;
  entries: Entry[];
  monthEntries: Entry[];
  recurringItems: RecurringItem[];
  selectedMonthKey: string;
};

export type LegacyWorkspace = {
  id: string;
  name: string;
  color: string;
};

export type LegacyEntry = {
  id: number;
  name: string;
  amount: number;
  type: "income" | "expense" | "sub" | "fixed";
  cat: string;
  ws: string;
  date?: string;
  link?: string;
  note?: string;
};

export type LegacyImportPayload = {
  accountId?: string;
  entries: LegacyEntry[];
  workspaces: LegacyWorkspace[];
  subs: LegacyEntry[];
};

export type AiSuggestion = {
  type?: "income" | "expense" | "sub" | "fixed";
  cat?: string;
  ws?: string;
};

export type OcrSuggestion = AiSuggestion & {
  name?: string;
  amount?: number;
  date?: string;
};

export type BankProvider = "nordea_csv";

export type BankImportBatch = {
  id: string;
  accountId: string;
  createdBy: string;
  provider: BankProvider;
  sourceName: string;
  fileName: string;
  defaultWorkspaceId: string | null;
  status: "parsed" | "applied" | "failed";
  createdAt: string;
};

export type BankImportAction = "import_new" | "link_existing" | "ignore" | "mark_transfer";
export type BankImportReviewGroup = "new" | "probable_match" | "transfer" | "ignored_candidate";

export type BankSuggestion = {
  type: EntryType;
  cat: string;
  workspaceId: string | null;
};

export type BankMatchCandidate = {
  entryId: string;
  entryName: string;
  score: number;
  cat: string;
  workspaceId: string | null;
  type: EntryType;
};

export type BankImportReviewItem = {
  id: string;
  batchId: string;
  date: string;
  amount: number;
  currency: string;
  paymentType: string;
  rawLabel: string;
  normalizedLabel: string;
  entryType: EntryType;
  reviewGroup: BankImportReviewGroup;
  suggestedAction: BankImportAction;
  selectedAction: BankImportAction | null;
  suggestedMatch: BankMatchCandidate | null;
  suggestion: BankSuggestion | null;
  isOwnTransfer: boolean;
  isReserved: boolean;
};

export type BankImportReviewSummary = {
  total: number;
  autoAppliedCount: number;
  reviewCount: number;
  probableMatchCount: number;
  ignoredCount: number;
  batchCompleted: boolean;
};

export type BankImportContext = {
  defaultWorkspaceId: string | null;
  defaultWorkspaceName: string | null;
};
