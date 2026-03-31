"use client";

import { useMemo, useState } from "react";
import { RecurringRow } from "@/components/RecurringRow";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import type { AppAccount, Entry, RecurringItem, Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

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
  emptyLabel,
  recurringType
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
  emptyLabel: string;
  recurringType: "fixed" | "sub";
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

    return matchesQuery && item.type === recurringType;
  });

  return (
    <>
      <Topbar
        accountSlug={accountSlug}
        accounts={accounts}
        actions={
          <ToolbarActions
            accountId={accountId}
            addLabel={recurringType === "fixed" ? "+ Fast inntekt" : "+ Fast utgift"}
            allowedAddTypes={[recurringType]}
            csvFilename={recurringType === "fixed" ? "kroner-faste-inntekter.csv" : "kroner-faste-utgifter.csv"}
            currentWorkspaceId={currentWorkspaceId}
            defaultAddType={recurringType}
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
          <div className={cx(styles.tableHeader, styles.recurringTableHeader)}>
            <div className={styles.th}>Navn</div>
            <div className={styles.th}>Type</div>
            <div className={styles.th}>Kategori</div>
            <div className={styles.th}>Prosjekt</div>
            <div className={cx(styles.th, styles.thRight)}>Beløp</div>
            <div className={styles.th} />
          </div>
          <div className={styles.entryList}>
            {filteredItems.map((item) => (
              <RecurringRow
                key={item.id}
                deletable
                item={item}
                workspace={item.workspaceId ? workspaceMap.get(item.workspaceId) : undefined}
                workspaces={workspaces}
              />
            ))}
          </div>
          {filteredItems.length === 0 ? <div className={styles.emptyState}>{emptyLabel}</div> : null}
        </div>
      </div>
    </>
  );
}
