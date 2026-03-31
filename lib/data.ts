import { getAccountContext } from "@/lib/accounts";
import { getCurrentMonthKey, getMonthBounds, parseMonthKey } from "@/lib/month";
import type { DashboardData, Entry, RecurringItem, Workspace } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type WorkspaceRow = {
  id: string;
  account_id: string;
  created_by: string;
  legacy_id: string | null;
  name: string;
  color: string;
};

type EntryRow = {
  id: string;
  account_id: string;
  created_by: string;
  legacy_id: string | null;
  name: string;
  amount: number;
  type: "income" | "expense";
  cat: string;
  workspace_id: string | null;
  source_workspace_id: string | null;
  date: string;
  link: string | null;
  note: string | null;
  created_at: string;
};

type RecurringRow = {
  id: string;
  account_id: string;
  created_by: string;
  legacy_id: string | null;
  name: string;
  amount: number;
  type: "sub" | "fixed";
  cat: string;
  workspace_id: string | null;
  link: string | null;
  day_of_month: number;
  created_at: string;
};

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    accountId: row.account_id,
    createdBy: row.created_by,
    legacyId: row.legacy_id,
    name: row.name,
    color: row.color
  };
}

function mapEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    accountId: row.account_id,
    createdBy: row.created_by,
    legacyId: row.legacy_id,
    name: row.name,
    amount: Number(row.amount),
    type: row.type,
    cat: row.cat,
    workspaceId: row.workspace_id,
    sourceWorkspaceId: row.source_workspace_id,
    date: row.date,
    link: row.link,
    note: row.note,
    sourceKind: "entry",
    recurringType: null,
    projectedFromRecurringId: null,
    isProjected: false,
    createdAt: row.created_at
  };
}

function mapRecurring(row: RecurringRow): RecurringItem {
  return {
    id: row.id,
    accountId: row.account_id,
    createdBy: row.created_by,
    legacyId: row.legacy_id,
    name: row.name,
    amount: Number(row.amount),
    type: row.type,
    cat: row.cat,
    workspaceId: row.workspace_id,
    link: row.link,
    dayOfMonth: row.day_of_month,
    createdAt: row.created_at
  };
}

function clampRecurringDay(year: number, monthIndex: number, dayOfMonth: number) {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(dayOfMonth, maxDay));
}

function normalizeComparableName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isProjectedDuplicate(item: RecurringItem, actualEntries: Entry[]) {
  const projectedType = item.type === "fixed" ? "income" : "expense";
  const normalizedName = normalizeComparableName(item.name);

  return actualEntries.some((entry) => {
    if (entry.sourceKind === "recurring" || entry.isProjected) {
      return false;
    }

    return (
      entry.type === projectedType &&
      Math.abs(entry.amount - item.amount) < 0.001 &&
      entry.cat === item.cat &&
      entry.workspaceId === item.workspaceId &&
      normalizeComparableName(entry.name) === normalizedName
    );
  });
}

function projectRecurringEntry(item: RecurringItem, monthKey: string): Entry {
  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;
  const day = clampRecurringDay(year, monthIndex, item.dayOfMonth || 1);
  const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const type = item.type === "fixed" ? "income" : "expense";
  const projectedLabel = item.type === "fixed" ? "Fast inntekt" : "Fast utgift";

  return {
    id: `recurring:${item.id}:${monthKey}`,
    accountId: item.accountId,
    createdBy: item.createdBy,
    legacyId: item.legacyId,
    name: item.name,
    amount: item.amount,
    type,
    cat: item.cat,
    workspaceId: item.workspaceId,
    sourceWorkspaceId: null,
    date,
    link: item.link,
    note: projectedLabel,
    sourceKind: "recurring",
    recurringType: item.type,
    projectedFromRecurringId: item.id,
    isProjected: true,
    createdAt: item.createdAt
  };
}

export async function getDashboardData(
  accountSlug?: string,
  workspaceId?: string,
  monthKey?: string,
  options?: {
    includeHistoricalEntries?: boolean;
  }
): Promise<DashboardData> {
  const supabase = await createClient();
  const accountContext = await getAccountContext(accountSlug);
  const selectedMonthKey = parseMonthKey(monthKey)?.key ?? getCurrentMonthKey();
  const includeHistoricalEntries = options?.includeHistoricalEntries ?? false;

  const workspacesRes = await supabase
    .from("workspaces")
    .select("id, account_id, created_by, legacy_id, name, color")
    .eq("account_id", accountContext.currentAccount.id)
    .order("name");

  if (workspacesRes.error) {
    throw new Error(workspacesRes.error.message);
  }

  const workspaces = (workspacesRes.data ?? []).map(mapWorkspace);
  const monthBounds = getMonthBounds(selectedMonthKey);
  const useAllWorkspaces = !workspaceId || workspaceId === "all";
  const currentWorkspace =
    useAllWorkspaces
      ? null
      : workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  const currentWorkspaceId = currentWorkspace?.id ?? "all";

  let monthEntriesQuery = supabase
    .from("entries")
    .select(
      "id, account_id, created_by, legacy_id, name, amount, type, cat, workspace_id, source_workspace_id, date, link, note, created_at"
    )
    .eq("account_id", accountContext.currentAccount.id)
    .gte("date", monthBounds.start)
    .lte("date", monthBounds.end)
    .order("date", { ascending: false });

  let recurringQuery = supabase
    .from("recurring_items")
    .select(
      "id, account_id, created_by, legacy_id, name, amount, type, cat, workspace_id, link, day_of_month, created_at"
    )
    .eq("account_id", accountContext.currentAccount.id)
    .order("name");

  if (currentWorkspace) {
    monthEntriesQuery = monthEntriesQuery.eq("workspace_id", currentWorkspace.id);
    recurringQuery = recurringQuery.eq("workspace_id", currentWorkspace.id);
  }

  const historicalEntriesPromise = includeHistoricalEntries
    ? (() => {
        let query = supabase
          .from("entries")
          .select(
            "id, account_id, created_by, legacy_id, name, amount, type, cat, workspace_id, source_workspace_id, date, link, note, created_at"
          )
          .eq("account_id", accountContext.currentAccount.id)
          .order("date", { ascending: false });

        if (currentWorkspace) {
          query = query.eq("workspace_id", currentWorkspace.id);
        }

        return query;
      })()
    : Promise.resolve({ data: null, error: null });

  const [monthEntriesRes, recurringRes, historicalEntriesRes] = await Promise.all([
    monthEntriesQuery,
    recurringQuery,
    historicalEntriesPromise
  ]);

  if (monthEntriesRes.error) {
    throw new Error(monthEntriesRes.error.message);
  }

  if (recurringRes.error) {
    throw new Error(recurringRes.error.message);
  }

  if (historicalEntriesRes.error) {
    throw new Error(historicalEntriesRes.error.message);
  }

  const actualMonthEntries = (monthEntriesRes.data ?? []).map(mapEntry);
  const filteredEntries = includeHistoricalEntries
    ? (historicalEntriesRes.data ?? []).map(mapEntry)
    : actualMonthEntries;
  const filteredRecurringItems = (recurringRes.data ?? []).map(mapRecurring);
  const projectedMonthEntries = filteredRecurringItems
    .filter((item) => !isProjectedDuplicate(item, actualMonthEntries))
    .map((item) => projectRecurringEntry(item, selectedMonthKey));
  const monthEntries = [...actualMonthEntries, ...projectedMonthEntries].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  return {
    userEmail: accountContext.user.email ?? "",
    accounts: accountContext.accounts,
    currentAccount: accountContext.currentAccount,
    currentRole: accountContext.currentRole,
    members: accountContext.members,
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    entries: filteredEntries,
    monthEntries,
    recurringItems: filteredRecurringItems,
    selectedMonthKey
  };
}
