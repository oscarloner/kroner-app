"use client";

import { useEffect, useState } from "react";
import { AddModal } from "@/components/AddModal";
import { BankImportModal } from "@/components/BankImportModal";
import { CsvExportButton } from "@/components/CsvExportButton";
import { ScanModal } from "@/components/ScanModal";
import styles from "@/components/kroner.module.css";
import type { Entry, OcrSuggestion, RecurringItem, Workspace } from "@/lib/types";

type AddType = "income" | "expense" | "sub" | "fixed";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ToolbarActions({
  accountId,
  workspaces,
  currentWorkspaceId,
  entries,
  recurringItems,
  csvFilename,
  addLabel,
  defaultAddType,
  allowedAddTypes
}: {
  accountId: string;
  workspaces: Workspace[];
  currentWorkspaceId: string;
  entries: Entry[];
  recurringItems: RecurringItem[];
  csvFilename: string;
  addLabel?: string;
  defaultAddType?: AddType;
  allowedAddTypes?: AddType[];
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [prefill, setPrefill] = useState<OcrSuggestion | null>(null);

  function handleScanApply(result: OcrSuggestion) {
    setScanOpen(false);
    setPrefill(result);
    setAddOpen(true);
  }

  function handleAddClose() {
    setAddOpen(false);
    setPrefill(null);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }

      event.preventDefault();

      if (addOpen) {
        return;
      }

      setPrefill(null);
      setAddOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addOpen]);

  return (
    <>
      <div className={styles.toolbarActions}>
        <button className={cx(styles.smallButton, styles.toolbarScanButton)} onClick={() => setScanOpen(true)} type="button">
          Scan
        </button>
        <button
          className={cx(styles.smallButton, styles.toolbarDesktopOnly)}
          onClick={() => setBankImportOpen(true)}
          type="button"
        >
          Importer bank
        </button>
        <CsvExportButton
          className={cx(styles.smallButton, styles.toolbarDesktopOnly)}
          entries={entries}
          filename={csvFilename}
          label="↓ CSV"
          recurringItems={recurringItems}
          workspaces={workspaces}
        />
        <button
          className={cx(styles.primaryButtonSmall, styles.toolbarAddButton)}
          onClick={() => {
            setPrefill(null);
            setAddOpen(true);
          }}
          type="button"
        >
          {addLabel ?? "+ Legg til"}
        </button>
      </div>
      <ScanModal
        accountId={accountId}
        onApply={handleScanApply}
        onClose={() => setScanOpen(false)}
        open={scanOpen}
      />
      <BankImportModal
        accountId={accountId}
        currentWorkspaceId={currentWorkspaceId}
        onClose={() => setBankImportOpen(false)}
        open={bankImportOpen}
        workspaces={workspaces}
      />
      <AddModal
        accountId={accountId}
        allowedTypes={allowedAddTypes}
        currentWorkspaceId={currentWorkspaceId}
        defaultType={defaultAddType}
        onClose={handleAddClose}
        open={addOpen}
        prefill={prefill}
        workspaces={workspaces}
      />
    </>
  );
}
