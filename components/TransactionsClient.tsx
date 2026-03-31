"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const selectAllRef = useRef<HTMLInputElement | null>(null);

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
  const someVisibleSelected = allSelectableVisibleIds.some((id) => selectedIds.includes(id));

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }

    selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  function toggleVisibleSelection(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...allSelectableVisibleIds])));
      return;
    }

    setSelectedIds((current) => current.filter((id) => !allSelectableVisibleIds.includes(id)));
  }

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
          <div className={styles.listToolbar}>
            {selectedIds.length > 0 ? (
              <div className={styles.bulkBar}>
                <div className={styles.bulkCount}>{selectedIds.length} valgt</div>
                <select
                  className={cx(styles.select, styles.bulkSelect)}
                  disabled={bulkBusy}
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
                  className={cx(styles.select, styles.bulkSelect)}
                  disabled={bulkBusy}
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
                  disabled={bulkBusy}
                  onClick={handleBulkRecategorize}
                  type="button"
                >
                  {bulkBusy ? "Jobber..." : "Oppdater valgte"}
                </button>
                <button
                  className={styles.smallButton}
                  disabled={bulkBusy}
                  onClick={handleBulkDelete}
                  type="button"
                >
                  Slett valgte
                </button>
              </div>
            ) : (
              <div className={styles.filterBar}>
                <select
                  className={cx(styles.select, styles.filterSelect)}
                  onChange={(event) => setFilter(event.target.value as (typeof FILTERS)[number]["value"])}
                  value={filter}
                >
                  {FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={styles.tableHeader}>
            <label className={cx(styles.th, styles.tableHeaderCheckbox)}>
              <input
                ref={selectAllRef}
                aria-label="Velg alle synlige"
                checked={allVisibleSelected}
                className={styles.txCheckbox}
                onChange={(event) => toggleVisibleSelection(event.target.checked)}
                type="checkbox"
              />
            </label>
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
