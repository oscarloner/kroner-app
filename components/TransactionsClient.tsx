"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EntryRow } from "@/components/EntryRow";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import type { AppAccount, Entry, RecurringItem, Workspace } from "@/lib/types";

const FILTERS = [
  { value: "all", label: "Alle" },
  { value: "needs_attention", label: "Trenger avklaring" },
  { value: "income", label: "↑ Inntekt" },
  { value: "expense", label: "↓ Utgift" },
  { value: "with_recurring", label: "Fast post" }
] as const;

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function needsAttention(entry: Entry) {
  if (entry.isProjected || entry.reportingTreatment === "offset_hidden") {
    return false;
  }

  return !entry.workspaceId || entry.cat === "Annet" || Boolean(entry.recommendedRecurringMatch && !entry.recurringItemId);
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

        if (filter === "needs_attention") {
          return needsAttention(entry);
        }

        if (filter === "with_recurring") {
          return Boolean(entry.recurringItemId);
        }

        return true;
      })
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [monthEntries, query, filter]);
  const unresolvedCount = monthEntries.filter((entry) => needsAttention(entry)).length;

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

  return (
    <>
      <Topbar
        accountId={accountId}
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
          <section className={styles.transactionsFocus}>
            <div>
              <div className={styles.sectionDivider}>Månedens arbeid</div>
              <div className={styles.overviewFocusText}>
                Start med radene som mangler prosjekt, fortsatt står som <span className={styles.inlineCode}>Annet</span>,
                eller ser ut som en fast post som bør avklares.
              </div>
            </div>
            <div className={styles.transactionsFocusStats}>
              <div className={styles.transactionsFocusStat}>
                <span className={styles.cardLabel}>Trenger avklaring</span>
                <span className={styles.transactionsFocusValue}>{unresolvedCount}</span>
              </div>
              <div className={styles.transactionsFocusStat}>
                <span className={styles.cardLabel}>Valgt filter</span>
                <span className={styles.transactionsFocusValue}>
                  {FILTERS.find((item) => item.value === filter)?.label ?? "Alle"}
                </span>
              </div>
            </div>
          </section>

          <div className={styles.listToolbar}>
            {selectedIds.length > 0 ? (
              <div className={styles.bulkBar}>
                <div className={styles.bulkCount}>{selectedIds.length} valgt</div>
                <button
                  className={styles.smallButton}
                  disabled={bulkBusy}
                  onClick={() => setSelectedIds([])}
                  type="button"
                >
                  Fjern valg
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
                <div className={styles.listToolbarHint}>
                  {unresolvedCount > 0
                    ? `${unresolvedCount} transaksjoner trenger fortsatt avklaring`
                    : "Alle transaksjoner for måneden er avklart"}
                </div>
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
            <div className={styles.th}>Prosjekt</div>
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
                recurringItems={recurringItems}
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
