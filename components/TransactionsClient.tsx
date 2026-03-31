"use client";

import { useMemo, useState } from "react";
import { EntryRow } from "@/components/EntryRow";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import type { AppAccount, Entry, RecurringItem, Workspace } from "@/lib/types";

const FILTERS = [
  { value: "all", label: "Alle" },
  { value: "income", label: "↑ Inntekt" },
  { value: "expense", label: "↓ Utgift" },
  { value: "Fakturainntekter", label: "Faktura" },
  { value: "Lønn & honorar", label: "Lønn" },
  { value: "Programvare & verktøy", label: "Programvare" },
  { value: "Utstyr & hardware", label: "Utstyr" },
  { value: "Mat & drikke", label: "Mat" },
  { value: "Transport", label: "Transport" },
  { value: "Annet", label: "Annet" }
] as const;

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function TransactionsClient({
  title,
  currentPath,
  accountId,
  accountSlug,
  accounts,
  currentAccountId,
  currentAccountName,
  currentWorkspaceId,
  currentWorkspaceName,
  entries,
  monthEntries,
  recurringItems,
  selectedMonthKey,
  workspaces
}: {
  title: string;
  currentPath: string;
  accountId: string;
  accountSlug: string;
  accounts: AppAccount[];
  currentAccountId: string;
  currentAccountName: string;
  currentWorkspaceId: string;
  currentWorkspaceName?: string;
  entries: Entry[];
  monthEntries: Entry[];
  recurringItems: RecurringItem[];
  selectedMonthKey: string;
  workspaces: Workspace[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const workspaceMap = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return monthEntries
      .filter((entry) => {
        const matchesQuery =
          !normalizedQuery ||
          [entry.name, entry.cat, entry.note].some((part) =>
            (part || "").toLowerCase().includes(normalizedQuery)
          );

        if (!matchesQuery) {
          return false;
        }

        if (filter === "all") {
          return true;
        }

        if (filter === "income" || filter === "expense") {
          return entry.type === filter;
        }

        return entry.cat === filter;
      })
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [monthEntries, query, filter]);

  return (
    <>
      <Topbar
        accountSlug={accountSlug}
        accounts={accounts}
        actions={
          <ToolbarActions
            accountId={accountId}
            csvFilename={`kroner-transaksjoner-${selectedMonthKey}.csv`}
            currentWorkspaceId={currentWorkspaceId}
            entries={monthEntries}
            recurringItems={recurringItems}
            workspaces={workspaces}
          />
        }
        currentAccountId={currentAccountId}
        currentAccountName={currentAccountName}
        currentPath={currentPath}
        currentWorkspaceId={currentWorkspaceId}
        currentWorkspaceName={currentWorkspaceName}
        monthKey={selectedMonthKey}
        onSearchChange={setQuery}
        searchValue={query}
        title={title}
        workspaces={workspaces}
      />
      <div className={styles.content}>
        <div className={styles.page}>
          <div className={styles.filterRow}>
            {FILTERS.map((item) => (
              <button
                key={item.value}
                className={cx(styles.filterChip, item.value === filter && styles.filterChipActive)}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.tableHeader}>
            <div className={styles.th}>Navn</div>
            <div className={styles.th}>Dato</div>
            <div className={styles.th}>Kategori</div>
            <div className={styles.th}>Konto</div>
            <div className={cx(styles.th, styles.thRight)}>Beløp</div>
            <div className={styles.th} />
          </div>
          <div className={styles.entryList}>
            {filteredEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                deleteKind="entry"
                deletable
                entry={entry}
                workspace={entry.workspaceId ? workspaceMap.get(entry.workspaceId) : undefined}
              />
            ))}
            {filteredEntries.length === 0 ? (
              <div className={styles.emptyState}>Ingen transaksjoner matcher filtrene dine.</div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
