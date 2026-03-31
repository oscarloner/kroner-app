"use client";

import { useMemo, useState } from "react";
import { EntryRow } from "@/components/EntryRow";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import { CATEGORIES, type AppAccount, type Entry, type RecurringItem, type Workspace } from "@/lib/types";

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState<(typeof CATEGORIES)[number]>("Annet");
  const [bulkWorkspaceId, setBulkWorkspaceId] = useState(currentWorkspaceId === "all" ? "" : currentWorkspaceId);
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const selectableEntries = filteredEntries.filter((entry) => !entry.isProjected);
  const allSelectableVisibleIds = selectableEntries.map((entry) => entry.id);
  const allVisibleSelected =
    allSelectableVisibleIds.length > 0 && allSelectableVisibleIds.every((id) => selectedIds.includes(id));

  async function handleBulkDelete() {
    if (selectedIds.length === 0 || bulkBusy) {
      return;
    }

    setBulkBusy(true);

    try {
      const response = await fetch("/api/entries", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ids: selectedIds,
          kind: "entry"
        })
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(json.message || "Kunne ikke slette valgte transaksjoner.");
      }

      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Kunne ikke slette valgte transaksjoner.");
      setBulkBusy(false);
    }
  }

  async function handleBulkRecategorize() {
    if (selectedIds.length === 0 || bulkBusy) {
      return;
    }

    setBulkBusy(true);

    try {
      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ids: selectedIds,
          kind: "entry",
          cat: bulkCategory,
          workspaceId: bulkWorkspaceId || null
        })
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(json.message || "Kunne ikke oppdatere valgte transaksjoner.");
      }

      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Kunne ikke oppdatere valgte transaksjoner.");
      setBulkBusy(false);
    }
  }

  return (
    <>
      <Topbar
        accountSlug={accountSlug}
        accounts={accounts}
        actions={
          <ToolbarActions
            accountId={accountId}
            allowedAddTypes={["income", "expense", "sub", "fixed"]}
            csvFilename={`kroner-transaksjoner-${selectedMonthKey}.csv`}
            currentWorkspaceId={currentWorkspaceId}
            defaultAddType="expense"
            entries={monthEntries}
            recurringItems={[]}
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

          <div className={styles.bulkBar}>
            <label className={styles.bulkSelectAll}>
              <input
                checked={allVisibleSelected}
                className={styles.txCheckbox}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedIds((current) =>
                      Array.from(new Set([...current, ...allSelectableVisibleIds]))
                    );
                    return;
                  }

                  setSelectedIds((current) =>
                    current.filter((id) => !allSelectableVisibleIds.includes(id))
                  );
                }}
                type="checkbox"
              />
              Velg synlige
            </label>
            <div className={styles.bulkCount}>
              {selectedIds.length > 0 ? `${selectedIds.length} valgt` : "Ingen valgt"}
            </div>
            <select
              className={styles.select}
              disabled={selectedIds.length === 0 || bulkBusy}
              onChange={(event) => setBulkCategory(event.target.value as (typeof CATEGORIES)[number])}
              value={bulkCategory}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              disabled={selectedIds.length === 0 || bulkBusy}
              onChange={(event) => setBulkWorkspaceId(event.target.value)}
              value={bulkWorkspaceId}
            >
              <option value="">Uten konto</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <button
              className={styles.smallButton}
              disabled={selectedIds.length === 0 || bulkBusy}
              onClick={handleBulkRecategorize}
              type="button"
            >
              {bulkBusy ? "Jobber..." : "Oppdater valgte"}
            </button>
            <button
              className={styles.smallButton}
              disabled={selectedIds.length === 0 || bulkBusy}
              onClick={handleBulkDelete}
              type="button"
            >
              Slett valgte
            </button>
          </div>

          <div className={styles.tableHeader}>
            <div className={styles.th} />
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
                deletable={!entry.isProjected}
                entry={entry}
                onToggleSelect={(id, checked) =>
                  setSelectedIds((current) =>
                    checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)
                  )
                }
                selectable={!entry.isProjected}
                selected={selectedIds.includes(entry.id)}
                workspace={entry.workspaceId ? workspaceMap.get(entry.workspaceId) : undefined}
                sourceWorkspace={
                  entry.sourceWorkspaceId ? workspaceMap.get(entry.sourceWorkspaceId) : undefined
                }
                workspaces={workspaces}
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
