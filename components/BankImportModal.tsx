"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";
import {
  CATEGORIES,
  type BankImportAction,
  type BankImportReviewItem,
  type BankImportReviewSummary,
  type EntryType,
  type Workspace
} from "@/lib/types";
import { formatCurrency, formatSignedCurrency } from "@/lib/format";

type DecisionState = {
  action: BankImportAction;
  type: EntryType;
  cat: string;
  workspaceId: string | null;
  matchEntryId: string | null;
};

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function defaultDecision(
  item: BankImportReviewItem,
  defaultWorkspaceId: string
): DecisionState {
  return {
    action: item.suggestedAction,
    type: item.suggestion?.type ?? item.suggestedMatch?.type ?? item.entryType,
    cat: item.suggestion?.cat ?? item.suggestedMatch?.cat ?? "Annet",
    workspaceId:
      item.suggestion?.workspaceId ??
      item.suggestedMatch?.workspaceId ??
      defaultWorkspaceId ??
      null,
    matchEntryId: item.suggestedMatch?.entryId ?? null
  };
}

export function BankImportModal({
  accountId,
  currentWorkspaceId,
  open,
  onClose,
  workspaces
}: {
  accountId: string;
  currentWorkspaceId: string;
  open: boolean;
  onClose: () => void;
  workspaces: Workspace[];
}) {
  const defaultWorkspaceId = currentWorkspaceId === "all" ? workspaces[0]?.id ?? "" : currentWorkspaceId;
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<BankImportReviewItem[]>([]);
  const [summary, setSummary] = useState<BankImportReviewSummary | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus("");
    }
  }, [open]);

  const decisionCount = useMemo(
    () => Object.values(decisions).filter((decision) => decision.action !== "ignore").length,
    [decisions]
  );

  async function loadReview(nextBatchId: string) {
    const response = await fetch(
      `/api/bank-import/${nextBatchId}/review?accountId=${encodeURIComponent(accountId)}`
    );
    const json = (await response.json()) as {
      message?: string;
      items?: BankImportReviewItem[];
      summary?: BankImportReviewSummary;
    };

    if (!response.ok || !json.items || !json.summary) {
      throw new Error(json.message || "Kunne ikke hente review.");
    }

    setBatchId(nextBatchId);
    setItems(json.items);
    setSummary(json.summary);
    setDecisions(
      Object.fromEntries(
        json.items.map((item) => [item.id, defaultDecision(item, defaultWorkspaceId)])
      )
    );
  }

  async function handleParse() {
    if (!file) {
      setStatus("Velg en Nordea CSV først.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const formData = new FormData();
      formData.set("accountId", accountId);
      formData.set("file", file);

      const response = await fetch("/api/bank-import/parse", {
        method: "POST",
        body: formData
      });
      const json = (await response.json()) as {
        message?: string;
        batchId?: string;
      };

      if (!response.ok || !json.batchId) {
        throw new Error(json.message || "Kunne ikke parse CSV.");
      }

      await loadReview(json.batchId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke parse CSV.");
    } finally {
      setBusy(false);
    }
  }

  function updateDecision(id: string, patch: Partial<DecisionState>) {
    setDecisions((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch
      }
    }));
  }

  async function handleApply() {
    if (!batchId) {
      return;
    }

    setApplying(true);
    setStatus("");

    try {
      const response = await fetch(`/api/bank-import/${batchId}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountId,
          decisions: items.map((item) => ({
            transactionId: item.id,
            action: decisions[item.id]?.action ?? item.suggestedAction,
            type: decisions[item.id]?.type,
            cat: decisions[item.id]?.cat,
            workspaceId: decisions[item.id]?.workspaceId,
            matchEntryId: decisions[item.id]?.matchEntryId
          }))
        })
      });
      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke fullføre importen.");
      }

      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke fullføre importen.");
      setApplying(false);
    }
  }

  function resetState() {
    setFile(null);
    setBatchId(null);
    setItems([]);
    setSummary(null);
    setDecisions({});
    setStatus("");
    setBusy(false);
    setApplying(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className={cx(styles.overlay, styles.overlayOpen, styles.dialogOverlay, styles.fullScreenDialogOverlay)}
      onClick={() => {
        resetState();
        onClose();
      }}
      role="presentation"
    >
      <div
        className={cx(
          styles.modal,
          styles.dialogModal,
          styles.fullScreenDialogModal,
          styles.bankImportModal
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalTitle}>Nordea CSV-import</div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>CSV-fil</label>
          <input
            className={styles.input}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
          />
        </div>

        <div className={styles.bankImportSummaryRow}>
          <button className={styles.modalPrimary} disabled={busy || applying} onClick={handleParse} type="button">
            {busy ? "Parser..." : "Parse og bygg review"}
          </button>
          <button
            className={styles.modalCancel}
            disabled={busy || applying}
            onClick={() => {
              resetState();
              onClose();
            }}
            type="button"
          >
            Lukk
          </button>
        </div>

        {summary ? (
          <div className={styles.bankImportStats}>
            <div className={styles.aiChip}>Totalt {summary.total}</div>
            <div className={styles.aiChip}>Nye {summary.newCount}</div>
            <div className={styles.aiChip}>Match {summary.probableMatchCount}</div>
            <div className={styles.aiChip}>Transfer {summary.transferCount}</div>
            <div className={styles.aiChip}>Ignorert {summary.ignoredCount}</div>
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            <div className={styles.sectionDivider}>Review</div>
            <div className={styles.bankImportList}>
              {items.map((item) => {
                const decision = decisions[item.id] ?? defaultDecision(item, defaultWorkspaceId);
                const workspaceId = decision.workspaceId ?? "";
                return (
                  <article className={styles.bankImportCard} key={item.id}>
                    <div className={styles.bankImportCardTop}>
                      <div>
                        <div className={styles.txName}>{item.rawLabel}</div>
                        <div className={styles.txNote}>{item.normalizedLabel}</div>
                      </div>
                      <div className={styles.bankImportAmount}>{formatSignedCurrency(item.amount * (item.entryType === "expense" ? -1 : 1))}</div>
                    </div>

                    <div className={styles.bankImportMetaRow}>
                      <span className={styles.txMetaItem}>{item.date || "Uten dato"}</span>
                      <span className={styles.txMetaItem}>{item.paymentType}</span>
                      <span className={styles.txMetaItem}>{item.reviewGroup}</span>
                      {item.suggestedMatch ? (
                        <span className={styles.txMetaItem}>Match {item.suggestedMatch.score}</span>
                      ) : null}
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Handling</label>
                        <select
                          className={styles.select}
                          onChange={(event) =>
                            updateDecision(item.id, {
                              action: event.target.value as BankImportAction
                            })
                          }
                          value={decision.action}
                        >
                          <option value="import_new">Importer som ny</option>
                          {item.suggestedMatch ? <option value="link_existing">Koble til eksisterende</option> : null}
                          <option value="mark_transfer">Transfer/private</option>
                          <option value="ignore">Ignorer</option>
                        </select>
                      </div>

                      {decision.action === "link_existing" && item.suggestedMatch ? (
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Treff</label>
                          <select
                            className={styles.select}
                            onChange={(event) =>
                              updateDecision(item.id, { matchEntryId: event.target.value || null })
                            }
                            value={decision.matchEntryId ?? item.suggestedMatch.entryId}
                          >
                            <option value={item.suggestedMatch.entryId}>
                              {item.suggestedMatch.entryName} ({item.suggestedMatch.score})
                            </option>
                          </select>
                        </div>
                      ) : (
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Type</label>
                          <select
                            className={styles.select}
                            onChange={(event) =>
                              updateDecision(item.id, { type: event.target.value as EntryType })
                            }
                            value={decision.type}
                          >
                            <option value="expense">Utgift</option>
                            <option value="income">Inntekt</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {decision.action === "import_new" ? (
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Kategori</label>
                          <select
                            className={styles.select}
                            onChange={(event) => updateDecision(item.id, { cat: event.target.value })}
                            value={decision.cat}
                          >
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Konto</label>
                          <select
                            className={styles.select}
                            onChange={(event) =>
                              updateDecision(item.id, { workspaceId: event.target.value || null })
                            }
                            value={workspaceId}
                          >
                            {workspaces.map((workspace) => (
                              <option key={workspace.id} value={workspace.id}>
                                {workspace.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {item.suggestedMatch ? (
                      <div className={styles.bankImportHint}>
                        Eksisterende forslag: {item.suggestedMatch.entryName} ({item.suggestedMatch.cat})
                      </div>
                    ) : null}
                    {item.suggestion ? (
                      <div className={styles.bankImportHint}>
                        Læringsforslag: {item.suggestion.cat}
                        {item.suggestion.workspaceId
                          ? ` · ${workspaces.find((workspace) => workspace.id === item.suggestion?.workspaceId)?.name ?? "Ukjent konto"}`
                          : ""}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancel} disabled={applying} onClick={() => loadReview(batchId!)} type="button">
                Last inn på nytt
              </button>
              <button className={styles.modalPrimary} disabled={applying} onClick={handleApply} type="button">
                {applying ? "Importer..." : `Bruk valg (${decisionCount})`}
              </button>
            </div>
          </>
        ) : null}

        {status ? <div className={styles.statusText}>{status}</div> : null}
      </div>
    </div>
  );
}
