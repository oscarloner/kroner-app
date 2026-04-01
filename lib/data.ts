import { getAccountContext } from "@/lib/accounts";
import { getCurrentMonthKey, getMonthBounds, parseMonthKey } from "@/lib/month";
import { attachRecurringRecommendations } from "@/lib/recurring-match";
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
  recurring_item_id: string | null;
  source_workspace_id: string | null;
  date: string;
  link: string | null;
  note: string | null;
  transaction_kind?: string | null;
  reporting_treatment?: string | null;
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

function getErrorMessage(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message || fallback;
}

function isMissingRecurringItemColumn(error: { message?: string } | null | undefined) {
  return error?.message?.includes("entries.recurring_item_id does not exist") ?? false;
}

function mapEntryRows(rows: unknown[] | null | undefined) {
  return (rows ?? []).map((row) => mapEntry(row as EntryRow));
}

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
    recurringItemId: row.recurring_item_id,
    sourceWorkspaceId: row.source_workspace_id,
    date: row.date,
    link: row.link,
    note: row.note,
    transactionKind: (row.transaction_kind as Entry["transactionKind"]) ?? null,
    reportingTreatment: (row.reporting_treatment as Entry["reportingTreatment"]) ?? null,
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

function isProjectedDuplicate(item: RecurringItem, actualEntries: Entry[], monthKey: string) {
  const projectedType = item.type === "fixed" ? "income" : "expense";
  const normalizedName = normalizeComparableName(item.name);

  return actualEntries.some((entry) => {
    if (entry.sourceKind === "recurring" || entry.isProjected) {
      return false;
    }

    if (entry.recurringItemId === item.id && entry.date.slice(0, 7) === monthKey) {
      return true;
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
    transactionKind: null,
    reportingTreatment: "normal",
    sourceKind: "recurring",
    recurringType: item.type,
    projectedFromRecurringId: item.id,
    isProjected: true,
    createdAt: item.createdAt
  };
}

type EntryImportMetadataRow = {
  applied_entry_id: string | null;
  transaction_kind: Entry["transactionKind"];
  reporting_treatment: Entry["reportingTreatment"];
};

function applyEntryImportMetadata(entries: Entry[], metadataRows: EntryImportMetadataRow[]) {
  if (entries.length === 0 || metadataRows.length === 0) {
    return entries;
  }

  const metadataMap = new Map(
    metadataRows
      .filter((row) => row.applied_entry_id)
      .map((row) => [
        row.applied_entry_id as string,
        {
          transactionKind: row.transaction_kind ?? null,
          reportingTreatment: row.reporting_treatment ?? "normal"
        }
      ])
  );

  return entries.map((entry) => {
    const metadata = metadataMap.get(entry.id);
    if (!metadata) {
      return entry;
    }

    return {
      ...entry,
      transactionKind: metadata.transactionKind,
      reportingTreatment: metadata.reportingTreatment
    };
  });
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
  const entrySelectWithRecurring =
    "id, account_id, created_by, legacy_id, name, amount, type, cat, workspace_id, recurring_item_id, source_workspace_id, date, link, note, created_at";
  const entrySelectWithoutRecurring =
    "id, account_id, created_by, legacy_id, name, amount, type, cat, workspace_id, source_workspace_id, date, link, note, created_at";

  const buildMonthEntriesQuery = (includeRecurringItemId: boolean) =>
    supabase
      .from("entries")
      .select(includeRecurringItemId ? entrySelectWithRecurring : entrySelectWithoutRecurring)
      .eq("account_id", accountContext.currentAccount.id)
      .gte("date", monthBounds.start)
      .lte("date", monthBounds.end)
      .order("date", { ascending: false });

  const buildHistoricalEntriesQuery = (includeRecurringItemId: boolean) =>
    supabase
      .from("entries")
      .select(includeRecurringItemId ? entrySelectWithRecurring : entrySelectWithoutRecurring)
      .eq("account_id", accountContext.currentAccount.id)
      .order("date", { ascending: false });

  let monthEntriesQuery = buildMonthEntriesQuery(true);

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
        let query = buildHistoricalEntriesQuery(true);

        if (currentWorkspace) {
          query = query.eq("workspace_id", currentWorkspace.id);
        }

        return query;
      })()
    : Promise.resolve({ data: null, error: null });

  let [monthEntriesRes, recurringRes, historicalEntriesRes] = await Promise.all([
    monthEntriesQuery,
    recurringQuery,
    historicalEntriesPromise
  ]);

  if (
    isMissingRecurringItemColumn(monthEntriesRes.error) ||
    isMissingRecurringItemColumn(historicalEntriesRes.error)
  ) {
    let fallbackMonthEntriesQuery = buildMonthEntriesQuery(false);

    if (currentWorkspace) {
      fallbackMonthEntriesQuery = fallbackMonthEntriesQuery.eq("workspace_id", currentWorkspace.id);
    }

    const fallbackHistoricalEntriesPromise = includeHistoricalEntries
      ? (() => {
          let query = buildHistoricalEntriesQuery(false);

          if (currentWorkspace) {
            query = query.eq("workspace_id", currentWorkspace.id);
          }

          return query;
        })()
      : Promise.resolve({ data: null, error: null });

    [monthEntriesRes, historicalEntriesRes] = await Promise.all([
      fallbackMonthEntriesQuery,
      fallbackHistoricalEntriesPromise
    ]);
  }

  if (monthEntriesRes.error) {
    throw new Error(getErrorMessage(monthEntriesRes.error, "Kunne ikke hente transaksjoner for måneden."));
  }

  if (recurringRes.error) {
    throw new Error(getErrorMessage(recurringRes.error, "Kunne ikke hente faste poster."));
  }

  if (historicalEntriesRes.error) {
    throw new Error(
      getErrorMessage(historicalEntriesRes.error, "Kunne ikke hente historiske transaksjoner.")
    );
  }

  const monthEntryRows = mapEntryRows(monthEntriesRes.data);
  const historicalEntryRows = includeHistoricalEntries
    ? mapEntryRows(historicalEntriesRes.data)
    : monthEntryRows;
  const entryIds = Array.from(new Set(historicalEntryRows.map((entry) => entry.id)));
  let importMetadataRows: EntryImportMetadataRow[] = [];

  if (entryIds.length > 0) {
    const metadataRes = await supabase
      .from("bank_transactions")
      .select("applied_entry_id, transaction_kind, reporting_treatment")
      .eq("account_id", accountContext.currentAccount.id)
      .in("applied_entry_id", entryIds);

    if (metadataRes.error) {
      throw new Error(getErrorMessage(metadataRes.error, "Kunne ikke hente importmetadata."));
    }

    importMetadataRows = (metadataRes.data ?? []) as EntryImportMetadataRow[];
  }

  const filteredRecurringItems = (recurringRes.data ?? []).map(mapRecurring);
  const actualMonthEntries = attachRecurringRecommendations(
    applyEntryImportMetadata(monthEntryRows, importMetadataRows),
    filteredRecurringItems
  );
  const filteredEntries = attachRecurringRecommendations(
    applyEntryImportMetadata(historicalEntryRows, importMetadataRows),
    filteredRecurringItems
  );
  const projectedMonthEntries = filteredRecurringItems
    .filter((item) => !isProjectedDuplicate(item, actualMonthEntries, selectedMonthKey))
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
