import { DeleteItemButton } from "@/components/DeleteItemButton";
import styles from "@/components/kroner.module.css";
import { formatCurrency } from "@/lib/format";
import type { RecurringItem, Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

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
    <article className={styles.subCard}>
      {deletable ? <DeleteItemButton id={item.id} kind="recurring" /> : null}
      <div className={styles.subCardTop}>
        <div>
          <div className={styles.subCardName}>{item.name}</div>
          <div className={styles.subCardCategory}>{item.cat}</div>
        </div>
        <div className={styles.workspaceBadge}>
          <span
            className={styles.workspaceBadgeDot}
            style={{ backgroundColor: workspace?.color ?? "#787774" }}
          />
          {workspace?.name ?? "Uten konto"}
        </div>
      </div>
      <div className={cx(styles.subCardAmount, styles.expenseValue)}>
        {formatCurrency(item.amount)}
      </div>
      <div className={styles.subCardSub}>{formatCurrency(item.amount * 12)} / år</div>
    </article>
  );
}
