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
  recurringItems: RecurringItem[];
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
