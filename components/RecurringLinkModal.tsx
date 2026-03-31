"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";
import { CATEGORIES, type Entry, type RecurringItem, type Workspace } from "@/lib/types";

type LinkMode = "link" | "create";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function recurringTypeForEntry(entry: Entry) {
  return entry.type === "income" ? "fixed" : "sub";
}

function recurringLabelForEntry(entry: Entry) {
  return entry.type === "income" ? "fast inntekt" : "fast kostnad";
}

export function RecurringLinkModal({
  entry,
  linkedRecurring,
  open,
  onClose,
  recurringItems,
  workspaces
}: {
  entry: Entry;
  linkedRecurring: RecurringItem | null;
  open: boolean;
  onClose: () => void;
  recurringItems: RecurringItem[];
  workspaces: Workspace[];
}) {
  const [mode, setMode] = useState<LinkMode>(linkedRecurring ? "link" : "create");
  const [search, setSearch] = useState("");
  const [selectedRecurringId, setSelectedRecurringId] = useState(linkedRecurring?.id ?? "");
  const [recurringName, setRecurringName] = useState(entry.name);
  const [recurringCat, setRecurringCat] = useState(entry.cat);
  const [recurringWorkspaceId, setRecurringWorkspaceId] = useState(entry.workspaceId ?? "");
  const [recurringLink, setRecurringLink] = useState(entry.link ?? "");
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState(String(Number(entry.date.slice(8, 10))));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const prevOpen = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const recurringType = recurringTypeForEntry(entry);
  const filteredRecurringItems = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return recurringItems.filter((item) => {
      if (item.type !== recurringType) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [item.name, item.cat].some((part) => part.toLowerCase().includes(normalizedQuery));
    });
  }, [recurringItems, recurringType, search]);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setMode(linkedRecurring ? "link" : "create");
      setSearch("");
      setSelectedRecurringId(linkedRecurring?.id ?? filteredRecurringItems[0]?.id ?? "");
      setRecurringName(entry.name);
      setRecurringCat(entry.cat);
      setRecurringWorkspaceId(entry.workspaceId ?? "");
      setRecurringLink(entry.link ?? "");
      setRecurringDayOfMonth(String(Number(entry.date.slice(8, 10))));
      setBusy(false);
      setStatus("");
    }

    prevOpen.current = open;
  }, [entry, filteredRecurringItems, linkedRecurring, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

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
      const body =
        mode === "link"
          ? {
              id: entry.id,
              kind: "entry",
              operation: "link_recurring",
              recurringItemId: selectedRecurringId
            }
          : {
              id: entry.id,
              kind: "entry",
              operation: "create_recurring_from_entry",
              recurringName,
              recurringCat,
              recurringWorkspaceId: recurringWorkspaceId || null,
              recurringLink,
              recurringDayOfMonth: Number(recurringDayOfMonth)
            };

      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const json = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke lagre kobling.");
      }

      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke lagre kobling.");
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          kind: "entry",
          operation: "unlink_recurring"
        })
      });

      const json = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke fjerne kobling.");
      }

      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke fjerne kobling.");
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

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
        <div className={styles.modalTitle}>Koble til {recurringLabelForEntry(entry)}</div>

        <form className={styles.modalForm} onSubmit={handleSubmit} ref={formRef}>
          <div className={styles.segmentedControl}>
            <button
              className={cx(styles.segmentedButton, mode === "create" && styles.segmentedButtonActive)}
              onClick={() => setMode("create")}
              type="button"
            >
              Opprett ny
            </button>
            <button
              className={cx(styles.segmentedButton, mode === "link" && styles.segmentedButtonActive)}
              onClick={() => setMode("link")}
              type="button"
            >
              Koble til eksisterende
            </button>
          </div>

          {mode === "link" ? (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Søk i faste poster</label>
                <input
                  className={styles.input}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Navn eller kategori"
                  value={search}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Velg fast post</label>
                <select
                  className={styles.select}
                  onChange={(event) => setSelectedRecurringId(event.target.value)}
                  required
                  value={selectedRecurringId}
                >
                  <option value="" disabled>
                    Velg fast post
                  </option>
                  {filteredRecurringItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.cat} · {item.amount}
                    </option>
                  ))}
                </select>
              </div>

              {filteredRecurringItems.length === 0 ? (
                <div className={styles.statusText}>Ingen relevante faste poster funnet.</div>
              ) : null}
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Navn på fast post</label>
                <input
                  className={styles.input}
                  onChange={(event) => setRecurringName(event.target.value)}
                  required
                  value={recurringName}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Kategori</label>
                  <select
                    className={styles.select}
                    onChange={(event) => setRecurringCat(event.target.value)}
                    value={recurringCat}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Dag i måneden</label>
                  <input
                    className={styles.input}
                    max="31"
                    min="1"
                    onChange={(event) => setRecurringDayOfMonth(event.target.value)}
                    step="1"
                    type="number"
                    value={recurringDayOfMonth}
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Prosjekt</label>
                  <select
                    className={styles.select}
                    onChange={(event) => setRecurringWorkspaceId(event.target.value)}
                    value={recurringWorkspaceId}
                  >
                    <option value="">Uten prosjekt</option>
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
                    onChange={(event) => setRecurringLink(event.target.value)}
                    placeholder="https://..."
                    type="url"
                    value={recurringLink}
                  />
                </div>
              </div>
            </>
          )}

          <div className={styles.modalActions}>
            {linkedRecurring ? (
              <button className={styles.modalCancel} disabled={busy} onClick={handleUnlink} type="button">
                Fjern kobling
              </button>
            ) : (
              <button className={styles.modalCancel} onClick={onClose} type="button">
                Avbryt
              </button>
            )}
            <button
              className={styles.modalPrimary}
              disabled={busy || (mode === "link" && !selectedRecurringId)}
              type="submit"
            >
              {busy ? "Lagrer..." : mode === "link" ? "Koble til" : "Opprett og koble"}
            </button>
          </div>
        </form>

        {status ? <div className={styles.statusText}>{status}</div> : null}
      </div>
    </div>
  );
}
