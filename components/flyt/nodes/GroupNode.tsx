"use client";

import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { GroupNodeData, ItemNodeData } from "../flyt-types";
import styles from "../flyt.module.css";

function GroupNode({
  id,
  data,
  selected
}: {
  id: string;
  data: GroupNodeData;
  selected?: boolean;
}) {
  const { getNodes } = useReactFlow();

  // Compute sum from children
  const children = getNodes().filter((n) => n.parentId === id);
  const total = children.reduce((sum, n) => {
    const d = n.data as unknown as ItemNodeData;
    return sum + (d.amount ?? 0);
  }, 0);

  const totalFormatted = new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0
  }).format(total);

  return (
    <div
      className={styles.groupNode}
      style={{ outline: selected ? "2px solid #6366f1" : undefined }}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.groupHeader}>
        <span className={styles.groupToggle}>
          {data.isExpanded ? "▾" : "▸"}
        </span>
        <span className={styles.groupLabel}>{data.label}</span>
        <span className={styles.groupCount}>{children.length}</span>
      </div>
      {!data.isExpanded && (
        <div className={styles.groupTotal}>{totalFormatted}</div>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export default memo(GroupNode);
