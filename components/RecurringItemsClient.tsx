"use client";

import { useMemo, useState } from "react";
import { SubCard } from "@/components/SubCard";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import type { AppAccount, Entry, RecurringItem, Workspace } from "@/lib/types";

export function RecurringItemsClient({
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
  recurringItems,
  workspaces,
  selectedMonthKey,
  type,
  emptyLabel
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
  recurringItems: RecurringItem[];
  workspaces: Workspace[];
  selectedMonthKey: string;
  type: "fixed" | "sub";
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");

  const workspaceMap = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );

  const filteredItems = recurringItems.filter((item) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      [item.name, item.cat].some((part) => (part || "").toLowerCase().includes(normalizedQuery));

    return matchesQuery && item.type === type;
  });

  return (
    <>
      <Topbar
        accountSlug={accountSlug}
        accounts={accounts}
        actions={
          <ToolbarActions
            accountId={accountId}
            csvFilename={`kroner-${type}.csv`}
            currentWorkspaceId={currentWorkspaceId}
            entries={entries}
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
          <section className={styles.subGrid}>
            {filteredItems.map((item) => (
              <SubCard
                key={item.id}
                deletable
                item={item}
                workspace={item.workspaceId ? workspaceMap.get(item.workspaceId) : undefined}
              />
            ))}
          </section>
          {filteredItems.length === 0 ? <div className={styles.emptyState}>{emptyLabel}</div> : null}
        </div>
      </div>
    </>
  );
}
