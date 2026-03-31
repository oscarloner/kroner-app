"use client";

import { useState } from "react";
import styles from "@/components/kroner.module.css";

export function DeleteItemButton({
  id,
  kind
}: {
  id: string;
  kind: "entry" | "recurring";
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (busy || !window.confirm("Slette denne posten?")) {
      return;
    }

    setBusy(true);

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
      window.alert(error instanceof Error ? error.message : "Kunne ikke slette.");
      setBusy(false);
    }
  }

  return (
    <button className={styles.deleteButton} onClick={handleDelete} disabled={busy} type="button">
      {busy ? "…" : "×"}
    </button>
  );
}
