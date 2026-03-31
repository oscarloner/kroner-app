"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";

export function DeleteItemButton({
  id,
  kind
}: {
  id: string;
  kind: "entry" | "recurring";
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!confirming) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setConfirming(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [confirming]);

  async function handleDelete() {
    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/entries", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, kind })
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(json.message || "Kunne ikke slette.");
      }

      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kunne ikke slette.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.deleteWrap} ref={wrapRef}>
      <button
        className={styles.deleteButton}
        onClick={() => {
          setError("");
          setConfirming((value) => !value);
        }}
        disabled={busy}
        type="button"
      >
        {busy ? "…" : "×"}
      </button>
      {confirming ? (
        <div className={styles.deleteConfirm}>
          <div className={styles.deleteConfirmText}>Slette denne posten?</div>
          <div className={styles.deleteConfirmActions}>
            <button
              className={styles.deleteConfirmCancel}
              onClick={() => setConfirming(false)}
              disabled={busy}
              type="button"
            >
              Avbryt
            </button>
            <button
              className={styles.deleteConfirmApprove}
              onClick={handleDelete}
              disabled={busy}
              type="button"
            >
              {busy ? "Sletter..." : "Slett"}
            </button>
          </div>
          {error ? <div className={styles.deleteConfirmError}>{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
