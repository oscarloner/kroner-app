"use client";

import { useState } from "react";
import { Charts } from "@/components/Charts";
import styles from "@/components/kroner.module.css";
import { ToolbarActions } from "@/components/ToolbarActions";
import { Topbar } from "@/components/Topbar";
import type { Entry, RecurringItem, Workspace } from "@/lib/types";

export function GraphPageClient({
  title,
  currentPath,
  accountId,
  accountSlug,
  currentAccountName,
  currentWorkspaceId,
  currentWorkspaceName,
  entries,
  recurringItems,
  workspaces
}: {
  title: string;
  currentPath: string;
  accountId: string;
  accountSlug: string;
  currentAccountName: string;
  currentWorkspaceId: string;
  currentWorkspaceName?: string;
  entries: Entry[];
  recurringItems: RecurringItem[];
  workspaces: Workspace[];
}) {
  const [query, setQuery] = useState("");

  return (
    <>
      <Topbar
        accountSlug={accountSlug}
        actions={
          <ToolbarActions
            accountId={accountId}
            csvFilename="kroner-graf.csv"
            currentWorkspaceId={currentWorkspaceId}
            entries={entries}
            recurringItems={recurringItems}
            workspaces={workspaces}
          />
        }
        currentAccountName={currentAccountName}
        currentPath={currentPath}
        currentWorkspaceId={currentWorkspaceId}
        currentWorkspaceName={currentWorkspaceName}
        onSearchChange={setQuery}
        searchValue={query}
        title={title}
        workspaces={workspaces}
      />
      <div className={styles.content}>
        <div className={styles.page}>
          <Charts entries={entries} />
        </div>
      </div>
    </>
  );
}
