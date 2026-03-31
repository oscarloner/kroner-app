"use client";

import { useMemo, useState } from "react";
import { EntryRow } from "@/components/EntryRow";
import { CsvExportButton } from "@/components/CsvExportButton";
import { formatCurrency, formatMonthLabel, formatSignedCurrency } from "@/lib/format";
import type { Entry, RecurringItem, Workspace } from "@/lib/types";

function shiftMonth(date: Date, direction: -1 | 1) {
  return new Date(date.getFullYear(), date.getMonth() + direction, 1);
}

export function OverviewClient({
  entries,
  recurringItems,
  workspaces
}: {
  entries: Entry[];
  recurringItems: RecurringItem[];
  workspaces: Workspace[];
}) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
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

  const monthEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const date = new Date(entry.date);
        return (
          date.getMonth() === monthCursor.getMonth() &&
          date.getFullYear() === monthCursor.getFullYear() &&
          matches(entry)
        );
      }),
    [entries, monthCursor, normalizedQuery]
  );

  const filteredRecurring = useMemo(
    () => recurringItems.filter((item) => matches(item)),
    [recurringItems, normalizedQuery]
  );

  const fixedItems = filteredRecurring.filter((item) => item.type === "fixed");
  const subscriptionItems = filteredRecurring.filter((item) => item.type === "sub");
  const income = monthEntries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = monthEntries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const fixed = fixedItems.reduce((sum, item) => sum + item.amount, 0);
  const subscriptions = subscriptionItems.reduce((sum, item) => sum + item.amount, 0);
  const net = fixed + income - expense - subscriptions;

  return (
    <>
      <section className="toolbarPanel">
        <div className="monthNav">
          <button className="toolbarButton" onClick={() => setMonthCursor((value) => shiftMonth(value, -1))}>
            ‹
          </button>
          <div className="toolbarLabel">{formatMonthLabel(monthCursor)}</div>
          <button className="toolbarButton" onClick={() => setMonthCursor((value) => shiftMonth(value, 1))}>
            ›
          </button>
        </div>
        <input
          className="searchInput"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søk i navn, kategori eller notat…"
        />
        <CsvExportButton
          entries={entries}
          recurringItems={recurringItems}
          workspaces={workspaces}
          filename={`kroner-${monthCursor.getFullYear()}-${monthCursor.getMonth() + 1}.csv`}
        />
      </section>

      <section className="cardGrid">
        <article className="summaryCard">
          <div className="summaryLabel">Faste inntekter</div>
          <div className="summaryValue">{formatCurrency(fixed)}</div>
          <div className="summarySub">{fixedItems.length} kilder</div>
        </article>
        <article className="summaryCard">
          <div className="summaryLabel">Engangs</div>
          <div className="summaryValue">{formatCurrency(income)}</div>
          <div className="summarySub">
            {monthEntries.filter((entry) => entry.type === "income").length} poster
          </div>
        </article>
        <article className="summaryCard">
          <div className="summaryLabel">Utgifter</div>
          <div className="summaryValue">{formatCurrency(expense)}</div>
          <div className="summarySub">
            {monthEntries.filter((entry) => entry.type === "expense").length} poster
          </div>
        </article>
        <article className="summaryCard">
          <div className="summaryLabel">Abonnementer</div>
          <div className="summaryValue">{formatCurrency(subscriptions)}</div>
          <div className="summarySub">{subscriptionItems.length} aktive</div>
        </article>
        <article className="summaryCard">
          <div className="summaryLabel">Netto</div>
          <div className="summaryValue">{formatSignedCurrency(net)}</div>
          <div className="summarySub">Denne måneden</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelTitle">Siste aktivitet</div>
        <div className="entryList">
          {monthEntries
            .slice()
            .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
            .slice(0, 8)
            .map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                workspace={entry.workspaceId ? workspaceMap.get(entry.workspaceId) : undefined}
                deletable
                deleteKind="entry"
              />
            ))}
          {monthEntries.length === 0 ? (
            <div className="emptyState">Ingen transaksjoner for valgt måned.</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
