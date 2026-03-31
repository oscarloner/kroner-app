"use client";

import { useMemo, useState } from "react";
import { EntryRow } from "@/components/EntryRow";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import { formatCurrency, formatSignedCurrency } from "@/lib/format";
import type { AppAccount, Entry, RecurringItem, Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function OverviewClient({
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

  const workspaceMap = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const matches = (value: { name?: string | null; cat?: string | null; note?: string | null }) =>
    !normalizedQuery ||
    [value.name, value.cat, value.note].some((part) =>
      (part || "").toLowerCase().includes(normalizedQuery)
    );

  const filteredMonthEntries = monthEntries.filter((entry) => matches(entry));

  const filteredRecurring = recurringItems.filter((item) => matches(item));
  const fixedExpenseItems = filteredRecurring.filter(
    (item) => item.type === "fixed" || item.type === "sub"
  );
  const income = filteredMonthEntries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = filteredMonthEntries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const fixedExpenses = fixedExpenseItems.reduce((sum, item) => sum + item.amount, 0);
  const net = income - expense - fixedExpenses;

  return (
    <>
      <Topbar
        accountSlug={accountSlug}
        accounts={accounts}
        actions={
          <ToolbarActions
            accountId={accountId}
            allowedAddTypes={["income", "expense", "fixed"]}
            csvFilename={`kroner-${selectedMonthKey}.csv`}
            currentWorkspaceId={currentWorkspaceId}
            defaultAddType="expense"
            entries={filteredMonthEntries}
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
          <section className={styles.cards}>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Faste utgifter</div>
              <div className={cx(styles.cardValue, styles.expenseValue)}>{formatCurrency(fixedExpenses)}</div>
              <div className={styles.cardSub}>{fixedExpenseItems.length} poster</div>
            </article>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Inntekter</div>
              <div className={cx(styles.cardValue, styles.incomeValue)}>{formatCurrency(income)}</div>
              <div className={styles.cardSub}>
                {filteredMonthEntries.filter((entry) => entry.type === "income").length} poster
              </div>
            </article>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Utgifter</div>
              <div className={cx(styles.cardValue, styles.expenseValue)}>{formatCurrency(expense)}</div>
              <div className={styles.cardSub}>
                {filteredMonthEntries.filter((entry) => entry.type === "expense").length} poster
              </div>
            </article>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Netto</div>
              <div className={styles.cardValue}>{formatSignedCurrency(net)}</div>
              <div className={styles.cardSub}>total</div>
            </article>
          </section>

          <div className={styles.sectionDivider}>Siste aktivitet</div>
          <div className={styles.tableHeader}>
            <div className={styles.th}>Navn</div>
            <div className={styles.th}>Dato</div>
            <div className={styles.th}>Kategori</div>
            <div className={styles.th}>Konto</div>
            <div className={cx(styles.th, styles.thRight)}>Beløp</div>
            <div className={styles.th} />
          </div>
          <div className={styles.entryList}>
            {filteredMonthEntries
              .slice()
              .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
              .slice(0, 8)
              .map((entry) => (
                <EntryRow
                  key={entry.id}
                  deleteKind="entry"
                  deletable
                  entry={entry}
                  workspace={entry.workspaceId ? workspaceMap.get(entry.workspaceId) : undefined}
                />
              ))}
            {filteredMonthEntries.length === 0 ? (
              <div className={styles.emptyState}>Ingen transaksjoner for valgt måned.</div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
