"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";
import { CATEGORIES, type RecurringItem, type Workspace } from "@/lib/types";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function RecurringItemEditModal({
  item,
  open,
  onClose,
  workspaces
}: {
  item: RecurringItem;
  open: boolean;
  onClose: () => void;
  workspaces: Workspace[];
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [cat, setCat] = useState(item.cat);
  const [workspaceId, setWorkspaceId] = useState(item.workspaceId ?? "");
  const [link, setLink] = useState(item.link ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const prevOpen = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setName(item.name);
      setAmount(String(item.amount));
      setCat(item.cat);
      setWorkspaceId(item.workspaceId ?? "");
      setLink(item.link ?? "");
      setBusy(false);
      setStatus("");
    }

    prevOpen.current = open;
  }, [item, open]);

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !busy) {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, onClose, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          kind: "recurring",
          name,
          amount: Number(amount),
          cat,
          workspaceId: workspaceId || null,
          link
        })
      });

      const json = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke oppdatere.");
      }

      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke oppdatere.");
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={cx(styles.overlay, styles.overlayOpen, styles.dialogOverlay, styles.fullScreenDialogOverlay)}
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-modal="true"
        className={cx(styles.modal, styles.dialogModal, styles.fullScreenDialogModal)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.modalTitle}>Rediger kostnad</div>

        <form className={styles.modalForm} onSubmit={handleSubmit} ref={formRef}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Navn</label>
            <input
              className={styles.input}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Beløp</label>
              <input
                className={styles.input}
                min="0"
                onChange={(event) => setAmount(event.target.value)}
                required
                step="0.01"
                type="number"
                value={amount}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Kategori</label>
              <select className={styles.select} onChange={(event) => setCat(event.target.value)} value={cat}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Konto</label>
              <select
                className={styles.select}
                onChange={(event) => setWorkspaceId(event.target.value)}
                value={workspaceId}
              >
                <option value="">Uten konto</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Lenke</label>
              <input
                className={styles.input}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://..."
                type="url"
                value={link}
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button className={styles.modalCancel} onClick={onClose} type="button">
              Avbryt
            </button>
            <button className={styles.modalPrimary} disabled={busy} type="submit">
              {busy ? "Lagrer..." : "Lagre endringer"}
            </button>
          </div>
        </form>

        {status ? <div className={styles.statusText}>{status}</div> : null}
      </div>
    </div>
  );
}
