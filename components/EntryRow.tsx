import { DeleteItemButton } from "@/components/DeleteItemButton";
import { formatCurrency } from "@/lib/format";
import type { Entry, Workspace } from "@/lib/types";

export function EntryRow({
  entry,
  workspace,
  deletable,
  deleteKind
}: {
  entry: Entry;
  workspace?: Workspace;
  deletable?: boolean;
  deleteKind?: "entry" | "recurring";
}) {
  const isIncome = entry.type === "income";

  return (
    <div className="entryRow">
      <div>
        <div className="entryName">{entry.name}</div>
        <div className="entrySub">{entry.cat}</div>
      </div>
      <div className="entryDate">{entry.date}</div>
      <div className="workspaceChip">
        <span
          className="workspaceDot"
          style={{ backgroundColor: workspace?.color ?? "#787774" }}
        />
        {workspace?.name ?? "Uten konto"}
      </div>
      <div className={isIncome ? "amountPositive" : "amountNegative"}>
        {isIncome ? "+" : "−"} {formatCurrency(entry.amount)}
      </div>
      {deletable && deleteKind ? <DeleteItemButton id={entry.id} kind={deleteKind} /> : <div />}
    </div>
  );
}
