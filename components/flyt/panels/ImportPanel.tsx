"use client";

import { useState } from "react";
import type { ImportedItem } from "../flyt-types";
import styles from "../flyt.module.css";

function parseJSON(text: string): ImportedItem[] {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error("Forventet et array");
  return arr.map((item: Record<string, unknown>) => ({
    name: String(item.name ?? item.label ?? ""),
    amount: parseFloat(String(item.amount ?? 0)) || 0,
    type: (item.type === "income" ? "income" : "expense") as "income" | "expense"
  })).filter((i) => i.name);
}

function parseCSV(text: string): ImportedItem[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => ["name", "navn", "label"].includes(h));
  const amtIdx = header.findIndex((h) => ["amount", "beløp", "belop", "sum"].includes(h));
  const typeIdx = header.findIndex((h) => ["type", "kind"].includes(h));

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      name: nameIdx >= 0 ? cols[nameIdx] : "",
      amount: amtIdx >= 0 ? parseFloat(cols[amtIdx]) || 0 : 0,
      type: (typeIdx >= 0 && cols[typeIdx] === "income" ? "income" : "expense") as "income" | "expense"
    };
  }).filter((i) => i.name);
}

export function ImportPanel({
  onImport,
  onClose
}: {
  onImport: (items: ImportedItem[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportedItem[] | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
      tryParse(content);
    };
    reader.readAsText(file);
  }

  function tryParse(raw: string) {
    setError(null);
    const trimmed = raw.trim();
    try {
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        setPreview(parseJSON(trimmed));
      } else {
        setPreview(parseCSV(trimmed));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ugyldig format");
      setPreview(null);
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    tryParse(e.target.value);
  }

  function handleImport() {
    if (preview && preview.length > 0) {
      onImport(preview);
      onClose();
    }
  }

  return (
    <div className={styles.importPanel}>
      <div className={styles.inspectorHeader}>
        <span className={styles.inspectorTitle}>Importer poster</span>
        <button className={styles.inspectorClose} onClick={onClose}>✕</button>
      </div>

      <label className={styles.inspectorLabel}>Last opp CSV eller JSON</label>
      <input
        type="file"
        accept=".csv,.json,.txt"
        className={styles.fileInput}
        onChange={handleFile}
      />

      <label className={styles.inspectorLabel}>Eller lim inn tekst</label>
      <textarea
        className={styles.importTextarea}
        value={text}
        onChange={handleTextChange}
        placeholder={`JSON:\n[{"name":"Slack","amount":450,"type":"expense"}]\n\nCSV:\nname,amount,type\nSlack,450,expense`}
        rows={8}
      />

      {error && <div className={styles.importError}>{error}</div>}

      {preview && preview.length > 0 && (
        <>
          <div className={styles.importPreviewLabel}>
            {preview.length} poster funnet
          </div>
          <div className={styles.importPreview}>
            {preview.slice(0, 8).map((item, i) => (
              <div key={i} className={styles.importPreviewItem}>
                <span>{item.name}</span>
                <span style={{ color: item.type === "income" ? "#0f7b55" : "#c9372c" }}>
                  {new Intl.NumberFormat("nb-NO", {
                    style: "currency",
                    currency: "NOK",
                    maximumFractionDigits: 0
                  }).format(item.amount)}
                </span>
              </div>
            ))}
            {preview.length > 8 && (
              <div className={styles.importPreviewMore}>+ {preview.length - 8} til</div>
            )}
          </div>
          <button className={styles.inspectorSave} onClick={handleImport}>
            Importer {preview.length} poster
          </button>
        </>
      )}
    </div>
  );
}
