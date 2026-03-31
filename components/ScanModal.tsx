"use client";

import { useState } from "react";
import styles from "@/components/kroner.module.css";
import type { OcrSuggestion } from "@/lib/types";

export function ScanModal({
  accountId,
  open,
  onClose,
  onApply
}: {
  accountId: string;
  open: boolean;
  onClose: () => void;
  onApply: (result: OcrSuggestion) => void;
}) {
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OcrSuggestion | null>(null);
  const [status, setStatus] = useState("");

  async function handleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const data = reader.result;
      if (typeof data !== "string") return;

      setPreview(data);
      setBusy(true);
      setResult(null);
      setStatus("");

      try {
        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            image: data.split(",")[1],
            mediaType: file.type
          })
        });

        const json = (await response.json()) as OcrSuggestion & { message?: string };
        if (!response.ok) {
          throw new Error(json.message || "OCR feilet.");
        }

        setResult(json);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "OCR feilet.");
      } finally {
        setBusy(false);
      }
    };

    reader.readAsDataURL(file);
  }

  function handleApply() {
    if (!result) return;
    onApply(result);
    setPreview("");
    setResult(null);
    setStatus("");
  }

  function handleClose() {
    setPreview("");
    setResult(null);
    setStatus("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className={`${styles.overlay} ${styles.overlayOpen}`} onClick={handleClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalTitle}>Scan kvittering</div>

        <div className={styles.cameraWrap}>
          <input
            accept="image/*"
            capture="environment"
            className={styles.cameraInput}
            onChange={handleImage}
            type="file"
          />
          {preview ? <img alt="Kvittering" className={styles.cameraPreview} src={preview} /> : null}
          <div className={styles.cameraLabel}>
            {busy
              ? "Claude leser bildet..."
              : preview
              ? "Ta nytt bilde for å prøve igjen"
              : "Ta bilde av kvittering eller velg fra galleri"}
          </div>
        </div>

        {result ? (
          <div className={styles.aiBox}>
            <div className={styles.aiBoxLabel}>Funnet i bildet</div>
            <div className={styles.aiBoxRow}>
              {result.name ? <span className={styles.aiChip}>{result.name}</span> : null}
              {typeof result.amount === "number" ? (
                <span className={styles.aiChip}>{result.amount} kr</span>
              ) : null}
              {result.date ? <span className={styles.aiChip}>{result.date}</span> : null}
              {result.cat ? <span className={styles.aiChip}>{result.cat}</span> : null}
              {result.type ? <span className={styles.aiChip}>{result.type}</span> : null}
            </div>
          </div>
        ) : null}

        {status ? <div className={styles.statusText}>{status}</div> : null}

        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={handleClose} type="button">
            Avbryt
          </button>
          <button
            className={styles.modalPrimary}
            disabled={!result || busy}
            onClick={handleApply}
            type="button"
          >
            Legg til transaksjon →
          </button>
        </div>
      </div>
    </div>
  );
}
