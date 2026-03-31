import { useState } from "react";
import { DeleteItemButton } from "@/components/DeleteItemButton";
import { EntryEditModal } from "@/components/EntryEditModal";
import styles from "@/components/kroner.module.css";
import { formatCurrency } from "@/lib/format";
import type { Entry, Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function EntryRow({
  entry,
  workspace,
  sourceWorkspace,
  workspaces,
  selectable,
  selected,
  onToggleSelect,
  deletable,
  deleteKind
}: {
  entry: Entry;
  workspace?: Workspace;
  sourceWorkspace?: Workspace;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  deletable?: boolean;
  deleteKind?: "entry" | "recurring";
  workspaces?: Workspace[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const isProjectedRecurring = entry.sourceKind === "recurring" || entry.isProjected;
  const typeClass = isProjectedRecurring
    ? entry.recurringType === "fixed"
      ? styles.typeFixed
      : styles.typeSub
    : entry.type === "income"
      ? styles.typeIncome
      : styles.typeExpense;
  const amountClass = isProjectedRecurring
    ? entry.recurringType === "fixed"
      ? styles.fixedValue
      : styles.expenseValue
    : entry.type === "income"
      ? styles.incomeValue
      : styles.expenseValue;
  const typeLabel = isProjectedRecurring
    ? entry.recurringType === "fixed"
      ? "Fast inntekt"
      : "Fast utgift"
    : entry.type === "income"
      ? "Inntekt"
      : "Utgift";
  const note =
    entry.note ||
    (isProjectedRecurring
      ? entry.recurringType === "fixed"
        ? "Planlagt fast inntekt"
        : "Planlagt fast utgift"
      : null);
  const showSourceWorkspace =
    Boolean(sourceWorkspace?.id) &&
    sourceWorkspace?.id !== workspace?.id &&
    !isProjectedRecurring;

  return (
    <>
      <div className={styles.txRow}>
        <div className={styles.txSelectCell}>
          {selectable ? (
            <input
              checked={Boolean(selected)}
              className={styles.txCheckbox}
              onChange={(event) => onToggleSelect?.(entry.id, event.target.checked)}
              type="checkbox"
            />
          ) : null}
        </div>
        <div className={styles.txMainCell}>
          <div className={styles.txName}>{entry.name}</div>
          {note ? <div className={styles.txNote}>{note}</div> : null}
          <div className={styles.txMetaCompact}>
            <span className={styles.txMetaItem}>{entry.date}</span>
            <span className={cx(styles.typeBadge, typeClass)}>{typeLabel}</span>
            <span className={styles.workspaceBadge}>
              <span
                className={styles.workspaceBadgeDot}
                style={{ backgroundColor: workspace?.color ?? "#787774" }}
              />
              {workspace?.name ?? "Uten prosjekt"}
            </span>
            {showSourceWorkspace ? (
              <span className={styles.txMetaItem}>Betalt fra {sourceWorkspace?.name}</span>
            ) : null}
          </div>
        </div>
        <div className={styles.txDate}>{entry.date}</div>
        <div className={cx(styles.typeBadge, typeClass)}>{typeLabel}</div>
        <div className={styles.workspaceBadge}>
          <span
            className={styles.workspaceBadgeDot}
            style={{ backgroundColor: workspace?.color ?? "#787774" }}
          />
          {workspace?.name ?? "Uten prosjekt"}
        </div>
        <div className={cx(styles.amount, amountClass)}>
          {entry.type === "income" ? "+" : "−"} {formatCurrency(entry.amount)}
        </div>
        <div className={styles.txActionCell}>
          {deletable && deleteKind && !isProjectedRecurring && workspaces?.length ? (
            <button className={styles.editButton} onClick={() => setEditOpen(true)} type="button">
              Rediger
            </button>
          ) : null}
          {deletable && deleteKind && !isProjectedRecurring ? (
            <DeleteItemButton id={entry.id} kind={deleteKind} />
          ) : (
            <div />
          )}
        </div>
      </div>
      {deletable && deleteKind && !isProjectedRecurring && workspaces?.length ? (
        <EntryEditModal entry={entry} onClose={() => setEditOpen(false)} open={editOpen} workspaces={workspaces} />
      ) : null}
    </>
  );
}
