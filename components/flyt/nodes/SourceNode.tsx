"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { SourceNodeData } from "../flyt-types";
import styles from "../flyt.module.css";

function SourceNode({ data, selected }: { data: SourceNodeData; selected?: boolean }) {
  return (
    <div
      className={styles.sourceNode}
      style={{
        borderColor: data.color,
        backgroundColor: `${data.color}22`,
        outline: selected ? `2px solid ${data.color}` : undefined
      }}
    >
      <div className={styles.sourceLabel} style={{ color: data.color }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <Handle type="target" position={Position.Left} className={styles.handle} />
    </div>
  );
}

export default memo(SourceNode);
