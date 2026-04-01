"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";
import { findRecommendedRecurringMatch } from "@/lib/recurring-match";
import { CATEGORIES, type Entry, type RecurringItem, type Workspace } from "@/lib/types";

type SecondaryMode = "other" | "create" | null;

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function recurringTypeForEntry(entry: Entry) {
  return entry.type === "income" ? "fixed" : "sub";
}

function recurringLabelForEntry(entry: Entry) {
  return entry.type === "income" ? "fast inntekt" : "fast kostnad";
}

function recurringBadgeLabel(entry: Entry) {
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
  const [search, setSearch] = useState("");
  const [secondaryMode, setSecondaryMode] = useState<SecondaryMode>(null);
  const [selectedRecurringId, setSelectedRecurringId] = useState("");
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
  const recommendedMatch = useMemo(
    () =>
      entry.recommendedRecurringMatch ??
      findRecommendedRecurringMatch({
        entryType: entry.type,
        entryName: entry.name,
        amount: entry.amount,
        workspaceId: entry.workspaceId ?? null,
        recurringItems,
        existingRecurringItemId: entry.recurringItemId ?? null
      }),
    [entry, recurringItems]
  );

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
      setSearch("");
      setSecondaryMode(null);
      setSelectedRecurringId(linkedRecurring?.id ?? recommendedMatch?.itemId ?? "");
      setRecurringName(entry.name);
      setRecurringCat(entry.cat);
      setRecurringWorkspaceId(entry.workspaceId ?? "");
      setRecurringLink(entry.link ?? "");
      setRecurringDayOfMonth(String(Number(entry.date.slice(8, 10))));
      setBusy(false);
      setStatus("");
    }

    prevOpen.current = open;
  }, [entry, linkedRecurring, open, recommendedMatch]);

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

  async function submitBody(body: Record<string, unknown>) {
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
  }

  async function handlePrimaryAction() {
    if (linkedRecurring) {
      onClose();
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      if (recommendedMatch) {
        await submitBody({
          id: entry.id,
          kind: "entry",
          operation: "link_recurring",
          recurringItemId: recommendedMatch.itemId
        });
        return;
      }

      await submitBody({
        id: entry.id,
        kind: "entry",
        operation: "create_recurring_from_entry",
        recurringName,
        recurringCat,
        recurringWorkspaceId: recurringWorkspaceId || null,
        recurringLink,
        recurringDayOfMonth: Number(recurringDayOfMonth)
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke lagre kobling.");
      setBusy(false);
    }
  }

  async function handleSecondarySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      if (secondaryMode === "other") {
        await submitBody({
          id: entry.id,
          kind: "entry",
          operation: "link_recurring",
          recurringItemId: selectedRecurringId
        });
        return;
      }

      await submitBody({
        id: entry.id,
        kind: "entry",
        operation: "create_recurring_from_entry",
        recurringName,
        recurringCat,
        recurringWorkspaceId: recurringWorkspaceId || null,
        recurringLink,
        recurringDayOfMonth: Number(recurringDayOfMonth)
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke lagre kobling.");
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setStatus("");

    try {
      await submitBody({
        id: entry.id,
        kind: "entry",
        operation: "unlink_recurring"
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke fjerne kobling.");
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

  const statusTitle = linkedRecurring
    ? `Allerede koblet til ${linkedRecurring.name}`
    : recommendedMatch
      ? `Vi fant sannsynlig ${recurringLabelForEntry(entry)}`
      : "Ingen fast post funnet";
  const statusBody = linkedRecurring
    ? `${entry.name} er koblet til ${recurringBadgeLabel(entry)} ${linkedRecurring.name}.`
    : recommendedMatch
      ? `${recommendedMatch.itemName} matcher navn, beløp og prosjekt godt.`
      : `Denne transaksjonen er ikke koblet til noen ${recurringLabelForEntry(entry)} ennå.`;
  const primaryLabel = linkedRecurring
    ? "Behold nåværende kobling"
    : recommendedMatch
      ? `Koble til ${recommendedMatch.itemName}`
      : `Opprett ny ${recurringLabelForEntry(entry)}`;

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
        <div className={styles.modalTitle}>Avklar {recurringLabelForEntry(entry)}</div>

        <div className={styles.recurringAssistCard}>
          <div className={styles.recurringAssistTitle}>{statusTitle}</div>
          <div className={styles.recurringAssistText}>{statusBody}</div>
          {recommendedMatch ? (
            <div className={styles.recurringAssistMeta}>
              Anbefalt treff: {recommendedMatch.itemName} · {recommendedMatch.score}% sikker
            </div>
          ) : null}
        </div>

        <form className={styles.modalForm} onSubmit={handleSecondarySubmit} ref={formRef}>
          {!linkedRecurring && !recommendedMatch ? (
            <div className={styles.recurringCreateInline}>
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
            </div>
          ) : null}

          <div className={styles.modalActions}>
            <button className={styles.modalCancel} onClick={onClose} type="button">
              Lukk
            </button>
            <button className={styles.modalPrimary} disabled={busy} onClick={handlePrimaryAction} type="button">
              {busy ? "Lagrer..." : primaryLabel}
            </button>
          </div>

          <div className={styles.recurringSecondarySection}>
            <div className={styles.recurringSecondaryLabel}>Andre valg</div>
            <div className={styles.recurringSecondaryActions}>
              {filteredRecurringItems.length > 0 ? (
                <button
                  className={styles.modalCancel}
                  onClick={() => setSecondaryMode((current) => (current === "other" ? null : "other"))}
                  type="button"
                >
                  Velg en annen {recurringLabelForEntry(entry)}
                </button>
              ) : null}
              <button
                className={styles.modalCancel}
                onClick={() => setSecondaryMode((current) => (current === "create" ? null : "create"))}
                type="button"
              >
                Opprett ny {recurringLabelForEntry(entry)}
              </button>
              {linkedRecurring ? (
                <button className={styles.modalCancel} disabled={busy} onClick={handleUnlink} type="button">
                  Fjern kobling
                </button>
              ) : null}
            </div>

            {secondaryMode === "other" ? (
              <div className={styles.recurringSecondaryPanel}>
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
                        {item.name} · {item.cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.modalPrimary} disabled={busy || !selectedRecurringId} type="submit">
                    {busy ? "Lagrer..." : "Koble til valgt fast post"}
                  </button>
                </div>
              </div>
            ) : null}

            {secondaryMode === "create" ? (
              <div className={styles.recurringSecondaryPanel}>
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

                <div className={styles.modalActions}>
                  <button className={styles.modalPrimary} disabled={busy} type="submit">
                    {busy ? "Lagrer..." : `Opprett ny ${recurringLabelForEntry(entry)}`}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </form>

        {status ? <div className={styles.statusText}>{status}</div> : null}
      </div>
    </div>
  );
}
