import { DeleteItemButton } from "@/components/DeleteItemButton";
import styles from "@/components/kroner.module.css";
import { formatCurrency } from "@/lib/format";
import type { Entry, Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

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
  const typeClass = entry.type === "income" ? styles.typeIncome : styles.typeExpense;
  const amountClass = entry.type === "income" ? styles.incomeValue : styles.expenseValue;
  const typeLabel = entry.type === "income" ? "Inntekt" : "Utgift";

  return (
    <div className={styles.txRow}>
      <div>
        <div className={styles.txName}>{entry.name}</div>
        {entry.note ? <div className={styles.txNote}>{entry.note}</div> : null}
      </div>
      <div className={styles.txDate}>{entry.date}</div>
      <div className={cx(styles.typeBadge, typeClass)}>{typeLabel}</div>
      <div className={styles.workspaceBadge}>
        <span
          className={styles.workspaceBadgeDot}
          style={{ backgroundColor: workspace?.color ?? "#787774" }}
        />
        {workspace?.name ?? "Uten konto"}
      </div>
      <div className={cx(styles.amount, amountClass)}>
        {entry.type === "income" ? "+" : "−"} {formatCurrency(entry.amount)}
      </div>
      {deletable && deleteKind ? <DeleteItemButton id={entry.id} kind={deleteKind} /> : <div />}
    </div>
  );
}
