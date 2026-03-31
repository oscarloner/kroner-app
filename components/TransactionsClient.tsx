"use client";

import { useMemo, useState } from "react";
import { EntryRow } from "@/components/EntryRow";
import type { Entry, Workspace } from "@/lib/types";

const FILTERS = [
  { value: "all", label: "Alle" },
  { value: "income", label: "Inntekt" },
  { value: "expense", label: "Utgift" },
  { value: "Fakturainntekter", label: "Faktura" },
  { value: "Lønn & honorar", label: "Lønn" },
  { value: "Programvare & verktøy", label: "Programvare" },
  { value: "Utstyr & hardware", label: "Utstyr" },
  { value: "Mat & drikke", label: "Mat" },
  { value: "Transport", label: "Transport" },
  { value: "Annet", label: "Annet" }
] as const;

export function TransactionsClient({
  entries,
  workspaces
}: {
  entries: Entry[];
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
    return entries
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
  }, [entries, query, filter]);

  return (
    <section className="panel">
      <div className="panelTitle">Alle transaksjoner</div>
      <input
        className="searchInput"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Søk i transaksjoner…"
      />
      <div className="filterRow">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={item.value === filter ? "filterChip active" : "filterChip"}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="entryList">
        {filteredEntries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            workspace={entry.workspaceId ? workspaceMap.get(entry.workspaceId) : undefined}
            deletable
            deleteKind="entry"
          />
        ))}
        {filteredEntries.length === 0 ? (
          <div className="emptyState">Ingen transaksjoner matcher filtrene dine.</div>
        ) : null}
      </div>
    </section>
  );
}
