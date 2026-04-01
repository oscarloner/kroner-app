"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EntryRow } from "@/components/EntryRow";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import { formatCurrency, formatMonthLabel, formatSignedCurrency } from "@/lib/format";
import { buildAppHref } from "@/lib/navigation";
import type { AppAccount, Entry, RecurringItem, Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function needsAttention(entry: Entry) {
  if (entry.isProjected || entry.reportingTreatment === "offset_hidden") {
    return false;
  }

  return !entry.workspaceId || entry.cat === "Annet" || Boolean(entry.recommendedRecurringMatch && !entry.recurringItemId);
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
  const reportingMonthEntries = filteredMonthEntries.filter(
    (entry) => entry.reportingTreatment !== "offset_hidden"
  );

  const filteredRecurring = recurringItems.filter((item) => matches(item));
  const fixedItems = filteredRecurring.filter((item) => item.type === "fixed");
  const subscriptionItems = filteredRecurring.filter((item) => item.type === "sub");
  const totalIncome = reportingMonthEntries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpense = reportingMonthEntries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const fixed = fixedItems.reduce((sum, item) => sum + item.amount, 0);
  const subscriptions = subscriptionItems.reduce((sum, item) => sum + item.amount, 0);
  const net = totalIncome - totalExpense;
  const unresolvedCount = reportingMonthEntries.filter((entry) => needsAttention(entry)).length;
  const workspaceSummaries = workspaces
    .map((workspace) => {
      const workspaceEntries = reportingMonthEntries.filter((entry) => entry.workspaceId === workspace.id);
      const income = workspaceEntries
        .filter((entry) => entry.type === "income")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const expense = workspaceEntries
        .filter((entry) => entry.type === "expense")
        .reduce((sum, entry) => sum + entry.amount, 0);

      return {
        workspace,
        income,
        expense,
        net: income - expense,
        unresolvedCount: workspaceEntries.filter((entry) => needsAttention(entry)).length,
        entryCount: workspaceEntries.length
      };
    })
    .filter((item) => item.entryCount > 0)
    .sort((left, right) => right.entryCount - left.entryCount);

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
          <section className={styles.overviewFocus}>
            <div className={styles.overviewFocusHeader}>
              <div>
                <div className={styles.sectionDivider}>Denne måneden</div>
                <div className={styles.overviewFocusTitle}>{formatMonthLabel(selectedMonthKey)}</div>
                <div className={styles.overviewFocusText}>
                  Start med transaksjonene som fortsatt trenger kategori, prosjekt eller fast-post-avklaring.
                </div>
              </div>
              <div className={styles.overviewFocusActions}>
                <Link
                  className={styles.smallButton}
                  href={
                    buildAppHref("/transaksjoner", {
                      accountSlug,
                      monthKey: selectedMonthKey,
                      workspaceId: currentWorkspaceId
                    }) as never
                  }
                >
                  Gå gjennom transaksjoner
                </Link>
              </div>
            </div>

            <div className={styles.cards}>
              <article className={styles.card}>
                <div className={styles.cardLabel}>Trenger avklaring</div>
                <div className={styles.cardValue}>{unresolvedCount}</div>
                <div className={styles.cardSub}>rader å gå gjennom</div>
              </article>
              <article className={styles.card}>
                <div className={styles.cardLabel}>Faste inntekter</div>
                <div className={cx(styles.cardValue, styles.fixedValue)}>{formatCurrency(fixed)}</div>
                <div className={styles.cardSub}>{fixedItems.length} kilder</div>
              </article>
              <article className={styles.card}>
                <div className={styles.cardLabel}>Inntekter</div>
                <div className={cx(styles.cardValue, styles.incomeValue)}>{formatCurrency(totalIncome)}</div>
                <div className={styles.cardSub}>
                  {reportingMonthEntries.filter((entry) => entry.type === "income").length} poster
                </div>
              </article>
              <article className={styles.card}>
                <div className={styles.cardLabel}>Utgifter</div>
                <div className={cx(styles.cardValue, styles.expenseValue)}>{formatCurrency(totalExpense)}</div>
                <div className={styles.cardSub}>
                  {reportingMonthEntries.filter((entry) => entry.type === "expense").length} poster
                </div>
              </article>
              <article className={styles.card}>
                <div className={styles.cardLabel}>Netto</div>
                <div className={styles.cardValue}>{formatSignedCurrency(net)}</div>
                <div className={styles.cardSub}>for valgt måned</div>
              </article>
            </div>
          </section>

          <div className={styles.sectionDivider}>Per prosjekt</div>
          <section className={styles.workspaceSummaryPanel}>
            <div className={styles.workspaceSummaryHeader}>
              <div className={styles.th}>Prosjekt</div>
              <div className={styles.th}>Inntekter</div>
              <div className={styles.th}>Utgifter</div>
              <div className={styles.th}>Netto</div>
              <div className={styles.th}>Status</div>
            </div>
            <div className={styles.workspaceSummaryList}>
              {workspaceSummaries.map((item) => (
                <article key={item.workspace.id} className={styles.workspaceSummaryRow}>
                  <div className={styles.workspaceSummaryProject}>
                    <div className={styles.workspaceBadge}>
                      <span
                        className={styles.workspaceBadgeDot}
                        style={{ backgroundColor: item.workspace.color }}
                      />
                      {item.workspace.name}
                    </div>
                    <div className={styles.workspaceSummaryMeta}>{item.entryCount} poster denne måneden</div>
                  </div>
                  <div className={styles.workspaceSummaryStat}>
                    <div className={styles.workspaceSummaryLabel}>Inntekter</div>
                    <div className={cx(styles.workspaceSummaryValue, styles.incomeValue)}>
                      {formatCurrency(item.income)}
                    </div>
                  </div>
                  <div className={styles.workspaceSummaryStat}>
                    <div className={styles.workspaceSummaryLabel}>Utgifter</div>
                    <div className={cx(styles.workspaceSummaryValue, styles.expenseValue)}>
                      {formatCurrency(item.expense)}
                    </div>
                  </div>
                  <div className={styles.workspaceSummaryStat}>
                    <div className={styles.workspaceSummaryLabel}>Netto</div>
                    <div className={styles.workspaceSummaryValue}>{formatSignedCurrency(item.net)}</div>
                  </div>
                  <div className={styles.workspaceSummaryStatus}>
                    {item.unresolvedCount > 0 ? (
                      <span className={styles.workspaceSummaryAlert}>{item.unresolvedCount} uavklart</span>
                    ) : (
                      <span className={styles.workspaceSummaryOk}>Avklart</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.cards}>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Faste utgifter</div>
              <div className={cx(styles.cardValue, styles.subValue)}>{formatCurrency(subscriptions)}</div>
              <div className={styles.cardSub}>{subscriptionItems.length} aktive</div>
            </article>
          </section>

          <div className={styles.sectionDivider}>Siste aktivitet</div>
          <div className={styles.tableHeader}>
            <div className={styles.th}>Navn</div>
            <div className={styles.th}>Dato</div>
            <div className={styles.th}>Kategori</div>
            <div className={styles.th}>Prosjekt</div>
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
                  deletable={!entry.isProjected}
                  entry={entry}
                  workspace={entry.workspaceId ? workspaceMap.get(entry.workspaceId) : undefined}
                  sourceWorkspace={
                    entry.sourceWorkspaceId ? workspaceMap.get(entry.sourceWorkspaceId) : undefined
                  }
                  recurringItems={recurringItems}
                  workspaces={workspaces}
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
