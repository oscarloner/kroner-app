"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { ItemNodeData } from "../flyt-types";
import styles from "../flyt.module.css";

const KIND_COLORS: Record<string, string> = {
  income: "#0f7b55",
  expense: "#c9372c",
  neutral: "#6b7280"
};

function ItemNode({ data, selected }: { data: ItemNodeData; selected?: boolean }) {
  const accent = KIND_COLORS[data.kind] ?? KIND_COLORS.neutral;
  const amtFormatted = new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0
  }).format(data.amount);

  return (
    <div
      className={styles.itemNode}
      style={{ borderLeftColor: accent, outline: selected ? `2px solid ${accent}` : undefined }}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.nodeLabel}>{data.label}</div>
      <div className={styles.nodeAmount} style={{ color: accent }}>
        {amtFormatted}
      </div>
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

export default memo(ItemNode);
