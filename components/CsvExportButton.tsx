"use client";

import type { Entry, RecurringItem, Workspace } from "@/lib/types";

export function CsvExportButton({
  entries,
  recurringItems,
  workspaces,
  filename
}: {
  entries: Entry[];
  recurringItems: RecurringItem[];
  workspaces: Workspace[];
  filename: string;
}) {
  function exportCsv() {
    const workspaceMap = Object.fromEntries(
      workspaces.map((workspace) => [workspace.id, workspace.name])
    );
    const rows = [["Navn", "Beløp", "Type", "Kategori", "Workspace", "Dato", "Notat", "Lenke"]];

    [...entries, ...recurringItems].forEach((item) => {
      rows.push([
        `"${item.name || ""}"`,
        String(item.amount || 0),
        item.type || "",
        `"${item.cat || ""}"`,
        `"${workspaceMap[item.workspaceId ?? ""] || ""}"`,
        "date" in item ? item.date || "" : "",
        `"${"note" in item ? item.note || "" : ""}"`,
        `"${item.link || ""}"`
      ]);
    });

    const blob = new Blob(["\uFEFF" + rows.map((row) => row.join(",")).join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="toolbarButton" onClick={exportCsv} type="button">
      CSV
    </button>
  );
}
