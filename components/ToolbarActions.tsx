"use client";

import { useState } from "react";
import { AddModal } from "@/components/AddModal";
import { CsvExportButton } from "@/components/CsvExportButton";
import styles from "@/components/kroner.module.css";
import type { Entry, RecurringItem, Workspace } from "@/lib/types";

export function ToolbarActions({
  accountId,
  workspaces,
  currentWorkspaceId,
  entries,
  recurringItems,
  csvFilename
}: {
  accountId: string;
  workspaces: Workspace[];
  currentWorkspaceId: string;
  entries: Entry[];
  recurringItems: RecurringItem[];
  csvFilename: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={styles.smallButton} onClick={() => setOpen(true)} type="button">
        Scan
      </button>
      <CsvExportButton
        className={styles.smallButton}
        entries={entries}
        filename={csvFilename}
        label="↓ CSV"
        recurringItems={recurringItems}
        workspaces={workspaces}
      />
      <button className={styles.primaryButtonSmall} onClick={() => setOpen(true)} type="button">
        + Legg til
      </button>
      <AddModal
        accountId={accountId}
        currentWorkspaceId={currentWorkspaceId}
        onClose={() => setOpen(false)}
        open={open}
        workspaces={workspaces}
      />
    </>
  );
}
