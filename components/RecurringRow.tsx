"use client";

import { useState } from "react";
import { DeleteItemButton } from "@/components/DeleteItemButton";
import { RecurringItemEditModal } from "@/components/RecurringItemEditModal";
import styles from "@/components/kroner.module.css";
import { formatCurrency } from "@/lib/format";
import type { RecurringItem, Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function RecurringRow({
  item,
  workspace,
  workspaces,
  deletable
}: {
  item: RecurringItem;
  workspace?: Workspace;
  workspaces: Workspace[];
  deletable?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const typeLabel = item.type === "sub" || item.cat === "Abonnementer" ? "Abonnement" : "Fast utgift";
  const typeClass = item.type === "sub" || item.cat === "Abonnementer" ? styles.typeSub : styles.typeFixed;

  return (
    <>
      <div className={styles.txRow}>
        <div className={styles.txMainCell}>
          <div className={styles.txName}>{item.name}</div>
          <div className={styles.txMetaCompact}>
            <span className={cx(styles.typeBadge, typeClass)}>{typeLabel}</span>
            <span className={styles.txMetaItem}>{item.cat}</span>
            <span className={styles.workspaceBadge}>
              <span
                className={styles.workspaceBadgeDot}
                style={{ backgroundColor: workspace?.color ?? "#787774" }}
              />
              {workspace?.name ?? "Uten konto"}
            </span>
          </div>
        </div>
        <div className={cx(styles.typeBadge, typeClass)}>{typeLabel}</div>
        <div className={styles.txCategory}>{item.cat}</div>
        <div className={styles.workspaceBadge}>
          <span
            className={styles.workspaceBadgeDot}
            style={{ backgroundColor: workspace?.color ?? "#787774" }}
          />
          {workspace?.name ?? "Uten konto"}
        </div>
        <div className={cx(styles.amount, styles.expenseValue)}>− {formatCurrency(item.amount)}</div>
        <div className={styles.txActionCell}>
          <button className={styles.editButton} onClick={() => setEditOpen(true)} type="button">
            Rediger
          </button>
          {deletable ? <DeleteItemButton id={item.id} kind="recurring" /> : <div />}
        </div>
      </div>
      <RecurringItemEditModal
        item={item}
        onClose={() => setEditOpen(false)}
        open={editOpen}
        workspaces={workspaces}
      />
    </>
  );
}
