import { DeleteItemButton } from "@/components/DeleteItemButton";
import { formatCurrency } from "@/lib/format";
import type { RecurringItem, Workspace } from "@/lib/types";

export function SubCard({
  item,
  workspace,
  deletable
}: {
  item: RecurringItem;
  workspace?: Workspace;
  deletable?: boolean;
}) {
  return (
    <article className="subCard">
      {deletable ? <DeleteItemButton id={item.id} kind="recurring" /> : null}
      <div className="subCardTop">
        <div>
          <div className="subCardName">{item.name}</div>
          <div className="subCardCat">{item.cat}</div>
        </div>
        <div className="workspaceChip">
          <span
            className="workspaceDot"
            style={{ backgroundColor: workspace?.color ?? "#787774" }}
          />
          {workspace?.name ?? "Uten konto"}
        </div>
      </div>
      <div className={item.type === "fixed" ? "amountFixed" : "amountNegative"}>
        {formatCurrency(item.amount)}
      </div>
      <div className="subCardYear">{formatCurrency(item.amount * 12)} / år</div>
    </article>
  );
}
