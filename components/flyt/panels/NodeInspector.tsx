"use client";

import { useState, useEffect } from "react";
import type { Node } from "@xyflow/react";
import type { ItemNodeData, SourceNodeData, GroupNodeData } from "../flyt-types";
import styles from "../flyt.module.css";

const KIND_OPTIONS = [
  { value: "income", label: "Inntekt" },
  { value: "expense", label: "Utgift" },
  { value: "neutral", label: "Nøytral" }
];

const SOURCE_COLORS = [
  "#6366f1", "#0f7b55", "#c9372c", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899"
];

export function NodeInspector({
  node,
  onUpdate,
  onDelete,
  onClose,
  onRemoveFromGroup
}: {
  node: Node;
  onUpdate: (id: string, patch: Partial<ItemNodeData & SourceNodeData & GroupNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onRemoveFromGroup?: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"income" | "expense" | "neutral">("expense");
  const [color, setColor] = useState("#6366f1");

  useEffect(() => {
    const d = node.data as unknown as ItemNodeData & SourceNodeData;
    setLabel(d.label ?? "");
    setAmount(String(d.amount ?? ""));
    setKind(d.kind ?? "expense");
    setColor(d.color ?? "#6366f1");
  }, [node.id, node.data]);

  function handleSave() {
    if (node.type === "item") {
      onUpdate(node.id, { label, amount: parseFloat(amount) || 0, kind });
    } else if (node.type === "source") {
      onUpdate(node.id, { label, color });
    } else if (node.type === "group") {
      onUpdate(node.id, { label });
    }
    onClose();
  }

  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorHeader}>
        <span className={styles.inspectorTitle}>
          {node.type === "item" ? "Post" : node.type === "source" ? "Kilde" : "Gruppe"}
        </span>
        <button className={styles.inspectorClose} onClick={onClose}>✕</button>
      </div>

      <label className={styles.inspectorLabel}>Navn</label>
      <input
        className={styles.inspectorInput}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        autoFocus
      />

      {node.type === "item" && (
        <>
          <label className={styles.inspectorLabel}>Beløp (kr)</label>
          <input
            className={styles.inspectorInput}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <label className={styles.inspectorLabel}>Type</label>
          <select
            className={styles.inspectorSelect}
            value={kind}
            onChange={(e) => setKind(e.target.value as "income" | "expense" | "neutral")}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </>
      )}

      {node.type === "source" && (
        <>
          <label className={styles.inspectorLabel}>Farge</label>
          <div className={styles.colorPicker}>
            {SOURCE_COLORS.map((c) => (
              <button
                key={c}
                className={styles.colorSwatch}
                style={{
                  backgroundColor: c,
                  outline: color === c ? "2px solid white" : undefined
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </>
      )}

      <div className={styles.inspectorActions}>
        <button className={styles.inspectorSave} onClick={handleSave}>
          Lagre
        </button>
        {node.parentId && onRemoveFromGroup && (
          <button
            className={styles.inspectorSecondary}
            onClick={() => { onRemoveFromGroup(node.id); onClose(); }}
          >
            Fjern fra gruppe
          </button>
        )}
        <button
          className={styles.inspectorDelete}
          onClick={() => { onDelete(node.id); onClose(); }}
        >
          Slett
        </button>
      </div>
    </div>
  );
}
