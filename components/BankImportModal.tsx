"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";
import {
  CATEGORIES,
  type BankImportAction,
  type BankImportContext,
  type BankImportReviewItem,
  type BankImportReviewSummary,
  type BankTransactionKind,
  type BankTransactionLinkStatus,
  type EntryType,
  type RecurringItem,
  type Workspace
} from "@/lib/types";
import { formatSignedCurrency } from "@/lib/format";
import { findRecommendedRecurringMatch } from "@/lib/recurring-match";

type DecisionState = {
  action: BankImportAction;
  type: EntryType;
  cat: string;
  workspaceId: string | null;
  matchEntryId: string | null;
  recurringAction: "none" | "link" | "create";
  recurringItemId: string | null;
  recurringName: string;
  recurringCat: string;
  recurringWorkspaceId: string | null;
  recurringLink: string;
  recurringDayOfMonth: number;
  transactionKind: BankTransactionKind;
};

type ModalStep = "upload" | "review";

const TRANSACTION_KIND_OPTIONS: Array<{ value: BankTransactionKind; label: string }> = [
  { value: "vipps", label: "Vipps" },
  { value: "bank_transfer", label: "Bankoverføring" },
  { value: "subscription_expense", label: "Abonnement / fast utgift" },
  { value: "subscription_income", label: "Fast inntekt" },
  { value: "invoice_income", label: "Fakturainnbetaling" },
  { value: "invoice_expense", label: "Fakturautbetaling" },
  { value: "salary_or_fee", label: "Lønn / honorar" },
  { value: "card_purchase", label: "Kortkjøp" },
  { value: "other", label: "Annet" }
];

const ACTION_OPTIONS: Array<{
  value: BankImportAction;
  label: string;
  description: string;
  className: string;
}> = [
  {
    value: "import_new",
    label: "Importer som ny",
    description: "Opprett en ny transaksjon med valgene under.",
    className: styles.bankImportActionPrimary
  },
  {
    value: "link_existing",
    label: "Koble til eksisterende",
    description: "Bruk eksisterende transaksjon som treff.",
    className: styles.bankImportActionMatch
  },
  {
    value: "mark_transfer",
    label: "Transfer/private",
    description: "Marker raden som privat overføring eller nulling.",
    className: styles.bankImportActionTransfer
  },
  {
    value: "ignore",
    label: "Ignorer",
    description: "Denne raden tas ikke med i importen.",
    className: styles.bankImportActionIgnore
  }
];

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function transactionKindLabel(value: BankTransactionKind) {
  return TRANSACTION_KIND_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function defaultDecision(
  item: BankImportReviewItem,
  defaultWorkspaceId: string
): DecisionState {
  const defaultWorkspace = item.suggestion?.workspaceId ?? item.suggestedMatch?.workspaceId ?? defaultWorkspaceId ?? null;

  return {
    action: item.suggestedAction,
    type: item.suggestion?.type ?? item.suggestedMatch?.type ?? item.entryType,
    cat: item.suggestion?.cat ?? item.suggestedMatch?.cat ?? "Annet",
    workspaceId: defaultWorkspace,
    matchEntryId: item.suggestedMatch?.entryId ?? null,
    recurringAction: "none",
    recurringItemId: null,
    recurringName: item.rawLabel,
    recurringCat: item.suggestion?.cat ?? "Annet",
    recurringWorkspaceId: defaultWorkspace,
    recurringLink: "",
    recurringDayOfMonth: Number(item.date.slice(8, 10)) || 1,
    transactionKind: item.transactionKind
  };
}

function getReviewPriority(item: BankImportReviewItem) {
  let priority = item.confidenceScore;

  if (item.reviewGroup === "probable_match") priority += 12;
  if (item.reviewGroup === "transfer") priority += 20;
  if (item.reviewGroup === "ignored_candidate") priority += 28;
  if (item.suggestedMatch) priority += 6;
  if (item.linkSuggestions.length > 0) priority += 4;

  return priority;
}

function actionLabel(action: BankImportAction) {
  switch (action) {
    case "import_new":
      return "Importer som ny";
    case "link_existing":
      return "Koble til treff";
    case "mark_transfer":
      return "Transfer/private";
    case "ignore":
      return "Ignorer";
  }
}

function reviewStatusText(item: BankImportReviewItem, decision: DecisionState) {
  if (decision.action === "link_existing" && item.suggestedMatch) {
    return `Match funnet: ${item.suggestedMatch.entryName}`;
  }

  if (decision.action === "import_new") {
    if (decision.recurringAction === "link") {
      return "Importer og kobler til fast post";
    }

    if (decision.recurringAction === "create") {
      return "Importer og oppretter fast post";
    }
  }

  return actionLabel(decision.action);
}

function getPreferredDefaultWorkspaceId(workspaces: Workspace[]) {
  return (
    workspaces.find((workspace) => workspace.name.trim().toLowerCase() === "privat")?.id ??
    workspaces[0]?.id ??
    ""
  );
}

function recurringTypeForEntryType(type: EntryType) {
  return type === "income" ? "fixed" : "sub";
}

function recurringLabelForEntryType(type: EntryType) {
  return type === "income" ? "fast inntekt" : "fast kostnad";
}

function shouldHighlightRecurring(item: BankImportReviewItem, recommendedMatch: { itemId: string } | null) {
  return (
    Boolean(recommendedMatch) ||
    item.transactionKind === "subscription_expense" ||
    item.transactionKind === "subscription_income" ||
    item.paymentType === "Avtalegiro"
  );
}

export function BankImportModal({
  accountId,
  currentWorkspaceId,
  open,
  onClose,
  recurringItems,
  workspaces
}: {
  accountId: string;
  currentWorkspaceId: string;
  open: boolean;
  onClose: () => void;
  recurringItems: RecurringItem[];
  workspaces: Workspace[];
}) {
  const defaultWorkspaceId =
    currentWorkspaceId === "all" ? getPreferredDefaultWorkspaceId(workspaces) : currentWorkspaceId;
  const defaultWorkspaceName =
    workspaces.find((workspace) => workspace.id === defaultWorkspaceId)?.name ?? "Ukjent prosjekt";
  const [step, setStep] = useState<ModalStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<BankImportReviewItem[]>([]);
  const [summary, setSummary] = useState<BankImportReviewSummary | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});
  const [linkDecisions, setLinkDecisions] = useState<Record<string, BankTransactionLinkStatus>>({});
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(defaultWorkspaceId);
  const [reviewContext, setReviewContext] = useState<BankImportContext>({
    defaultWorkspaceId,
    defaultWorkspaceName
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [recurringPanelOpen, setRecurringPanelOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedWorkspaceId(defaultWorkspaceId);
    setReviewContext({
      defaultWorkspaceId,
      defaultWorkspaceName
    });
  }, [defaultWorkspaceId, defaultWorkspaceName]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const priorityDiff = getReviewPriority(left) - getReviewPriority(right);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return new Date(right.date).getTime() - new Date(left.date).getTime();
      }),
    [items]
  );

  useEffect(() => {
    if (sortedItems.length === 0) {
      setSelectedItemId(null);
      return;
    }

    setSelectedItemId((current) =>
      current && sortedItems.some((item) => item.id === current) ? current : sortedItems[0].id
    );
  }, [sortedItems]);

  useEffect(() => {
    setAdvancedOpen(false);
    setRecurringPanelOpen(false);
  }, [selectedItemId]);

  const selectedItem = selectedItemId
    ? sortedItems.find((item) => item.id === selectedItemId) ?? null
    : null;
  const selectedDecision = selectedItem
    ? decisions[selectedItem.id] ??
      defaultDecision(selectedItem, reviewContext.defaultWorkspaceId ?? defaultWorkspaceId)
    : null;
  const selectedWorkspaceValue = selectedDecision?.workspaceId ?? "";
  const selectedRecurringWorkspaceValue = selectedDecision?.recurringWorkspaceId ?? "";
  const selectedRecommendedRecurringMatch = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    return (
      selectedItem.recommendedRecurringMatch ??
      findRecommendedRecurringMatch({
        entryType: selectedItem.entryType,
        entryName: selectedItem.rawLabel,
        amount: selectedItem.amount,
        workspaceId: reviewContext.defaultWorkspaceId ?? null,
        recurringItems
      })
    );
  }, [recurringItems, reviewContext.defaultWorkspaceId, selectedItem]);
  const selectedRecurringCandidates = useMemo(() => {
    if (!selectedItem) {
      return [];
    }

    return recurringItems.filter((item) => item.type === recurringTypeForEntryType(selectedItem.entryType));
  }, [recurringItems, selectedItem]);
  const selectedRecurringItem =
    selectedRecurringCandidates.find((item) => item.id === selectedDecision?.recurringItemId) ?? null;
  const recurringPanelVisible =
    Boolean(selectedItem && shouldHighlightRecurring(selectedItem, selectedRecommendedRecurringMatch)) ||
    recurringPanelOpen;
  const decisionCount = useMemo(
    () => Object.values(decisions).filter((decision) => decision.action !== "ignore").length,
    [decisions]
  );

  function resetState() {
    setStep("upload");
    setFile(null);
    setBatchId(null);
    setItems([]);
    setSummary(null);
    setDecisions({});
    setLinkDecisions({});
    setSelectedWorkspaceId(defaultWorkspaceId);
    setReviewContext({
      defaultWorkspaceId,
      defaultWorkspaceName
    });
    setSelectedItemId(null);
    setRecurringPanelOpen(false);
    setAdvancedOpen(false);
    setStatus("");
    setBusy(false);
    setApplying(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function loadReview(nextBatchId: string) {
    const response = await fetch(
      `/api/bank-import/${nextBatchId}/review?accountId=${encodeURIComponent(accountId)}`
    );
    const json = (await response.json()) as {
      message?: string;
      items?: BankImportReviewItem[];
      summary?: BankImportReviewSummary;
      importContext?: BankImportContext;
    };

    if (!response.ok || !json.items || !json.summary) {
      throw new Error(json.message || "Kunne ikke hente review.");
    }

    setBatchId(nextBatchId);
    setItems(json.items);
    setSummary(json.summary);
    setReviewContext(
      json.importContext ?? {
        defaultWorkspaceId: selectedWorkspaceId || null,
        defaultWorkspaceName:
          workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name ?? "Ukjent prosjekt"
      }
    );
    setDecisions(
      Object.fromEntries(
        json.items.map((item) => [
          item.id,
          defaultDecision(item, json.importContext?.defaultWorkspaceId ?? selectedWorkspaceId)
        ])
      )
    );
    setLinkDecisions(
      Object.fromEntries(
        json.items
          .flatMap((item) => item.linkSuggestions)
          .map((link) => [link.id, link.status === "suggested" ? "confirmed" : link.status])
      )
    );
    setStep("review");
  }

  async function handleParse() {
    if (!file) {
      setStatus("Velg en Nordea CSV først.");
      return;
    }

    if (!selectedWorkspaceId) {
      setStatus("Velg prosjekt/selskap for denne CSV-en først.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const formData = new FormData();
      formData.set("accountId", accountId);
      formData.set("workspaceId", selectedWorkspaceId);
      formData.set("file", file);

      const response = await fetch("/api/bank-import/parse", {
        method: "POST",
        body: formData
      });
      const json = (await response.json()) as {
        message?: string;
        batchId?: string;
        importContext?: BankImportContext;
        summary?: BankImportReviewSummary;
      };

      if (!response.ok || !json.batchId) {
        throw new Error(json.message || "Kunne ikke parse CSV.");
      }

      setReviewContext(
        json.importContext ?? {
          defaultWorkspaceId: selectedWorkspaceId,
          defaultWorkspaceName:
            workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name ?? "Ukjent prosjekt"
        }
      );
      setBatchId(json.batchId);
      setStep("review");

      if (json.summary) {
        setSummary(json.summary);
      }

      if (json.summary?.batchCompleted) {
        setItems([]);
        setDecisions({});
        setLinkDecisions({});
        setSelectedItemId(null);
        setStatus(
          `Import fullført. ${json.summary.autoAppliedCount} auto-importert, ${json.summary.ignoredCount} ignorert.`
        );
        return;
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

  async function handleCreateKnownRule(item: BankImportReviewItem) {
    const decision =
      decisions[item.id] ?? defaultDecision(item, reviewContext.defaultWorkspaceId ?? defaultWorkspaceId);

    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/bank-known-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountId,
          label: item.rawLabel,
          normalizedIncludes: [item.normalizedLabel],
          paymentType: item.paymentType || null,
          entryType: decision.type,
          transactionKind: decision.transactionKind,
          cat: decision.cat,
          workspaceId: decision.workspaceId,
          confidenceScore: Math.max(95, item.confidenceScore),
          reportingTreatment: item.reportingTreatment,
          autoApply: true
        })
      });
      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke lagre kjent regel.");
      }

      setStatus(`Lagret kjent regel for "${item.rawLabel}".`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke lagre kjent regel.");
    } finally {
      setBusy(false);
    }
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
          decisions: items.map((item) => {
            const decision = decisions[item.id] ?? defaultDecision(item, reviewContext.defaultWorkspaceId ?? defaultWorkspaceId);
            const effectiveAction =
              decision.action === "import_new"
                ? decision.recurringAction === "link"
                  ? "link_recurring"
                  : decision.recurringAction === "create"
                    ? "create_recurring"
                    : "import_new"
                : decision.action;

            return {
              transactionId: item.id,
              action: effectiveAction,
              type: decision.type,
              cat: decision.cat,
              workspaceId: decision.workspaceId,
              matchEntryId: decision.matchEntryId,
              recurringItemId: decision.recurringItemId,
              recurringName: decision.recurringName,
              recurringCat: decision.recurringCat,
              recurringWorkspaceId: decision.recurringWorkspaceId,
              recurringLink: decision.recurringLink,
              recurringDayOfMonth: decision.recurringDayOfMonth,
              transactionKind: decision.transactionKind
            };
          }),
          linkDecisions: Array.from(
            new Map(
              items
                .flatMap((item) => item.linkSuggestions)
                .map((link) => [link.id, linkDecisions[link.id] ?? link.status])
            ).entries()
          ).map(([linkId, linkStatus]) => ({
            linkId,
            status: linkStatus === "confirmed" ? "confirmed" : "rejected"
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
          styles.bankImportModal,
          step === "upload" ? styles.bankImportModalUpload : styles.bankImportModalReview
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.bankImportHeader}>
          <div>
            <div className={styles.modalTitle}>Nordea CSV-import</div>
            {step === "upload" ? (
              <div className={styles.bankImportLead}>
                Last opp fil først, og gå deretter gjennom det som trenger vurdering.
              </div>
            ) : null}
          </div>
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

        <div className={styles.bankImportSteps}>
          <div className={cx(styles.bankImportStep, step === "upload" && styles.bankImportStepActive)}>
            <span className={styles.bankImportStepNumber}>1</span>
            <span>Last opp fil</span>
          </div>
          <div className={cx(styles.bankImportStep, step === "review" && styles.bankImportStepActive)}>
            <span className={styles.bankImportStepNumber}>2</span>
            <span>Review og bruk valg</span>
          </div>
        </div>

        {step === "upload" ? (
          <div className={styles.bankImportUploadStage}>
            <div className={styles.bankImportIntroCard}>
              <div className={styles.bankImportIntroTitle}>Steg 1: Velg prosjekt og CSV-fil</div>
              <div className={styles.bankImportIntroText}>
                Vi parser filen og setter opp forslag. I neste steg går du bare gjennom radene som trenger vurdering.
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Denne CSV-en hører til prosjekt/selskap</label>
              <select
                className={styles.select}
                disabled={busy || applying}
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                value={selectedWorkspaceId}
              >
                <option value="" disabled>
                  Velg prosjekt/selskap
                </option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>CSV-fil</label>
              <input
                className={styles.input}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
              />
              {file ? <div className={styles.bankImportSelectedFile}>Valgt fil: {file.name}</div> : null}
            </div>

            <div className={styles.bankImportUploadActions}>
              <button className={styles.modalPrimary} disabled={busy || applying} onClick={handleParse} type="button">
                {busy ? "Parser..." : "Importer og gå til review"}
              </button>
              <button className={styles.modalCancel} disabled={busy || applying} onClick={resetState} type="button">
                Nullstill
              </button>
            </div>

            {busy ? (
              <div className={styles.bankImportParsingState} role="status" aria-live="polite">
                <div className={styles.bankImportParsingSpinner} aria-hidden="true" />
                <div>
                  <div className={styles.bankImportParsingTitle}>Parser CSV og bygger review</div>
                  <div className={styles.bankImportParsingText}>
                    Leser filen, foreslår handlinger og gjør klar steg 2.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={styles.bankImportReviewStage}>
            <div className={styles.bankImportReviewSummary}>
              <div className={styles.bankImportSummaryCard}>
                <div className={styles.bankImportSummaryLabel}>Prosjekt</div>
                <div className={styles.bankImportSummaryValue}>
                  {reviewContext.defaultWorkspaceName ?? defaultWorkspaceName}
                </div>
              </div>
              <div className={styles.bankImportSummaryCard}>
                <div className={styles.bankImportSummaryLabel}>Trenger review</div>
                <div className={styles.bankImportSummaryValue}>{summary?.reviewCount ?? items.length}</div>
              </div>
              <div className={styles.bankImportSummaryCard}>
                <div className={styles.bankImportSummaryLabel}>Auto-importert</div>
                <div className={styles.bankImportSummaryValue}>{summary?.autoAppliedCount ?? 0}</div>
              </div>
            </div>

            {summary?.batchCompleted ? (
              <div className={styles.bankImportEmptyState}>
                <div className={styles.bankImportIntroTitle}>Import fullført automatisk</div>
                <div className={styles.bankImportIntroText}>
                  Ingen rader trenger manuell review for denne filen.
                </div>
              </div>
            ) : sortedItems.length > 0 && selectedItem && selectedDecision ? (
              <div className={styles.bankImportWorkspace}>
                <div className={styles.bankImportListPane}>
                  <div className={styles.bankImportPaneTitle}>Rader som trenger vurdering</div>
                  <div className={styles.bankImportList}>
                    {sortedItems.map((item) => {
                      const decision =
                        decisions[item.id] ??
                        defaultDecision(item, reviewContext.defaultWorkspaceId ?? defaultWorkspaceId);

                      return (
                        <button
                          key={item.id}
                          className={cx(
                            styles.bankImportListItem,
                            selectedItemId === item.id && styles.bankImportListItemActive
                          )}
                          onClick={() => setSelectedItemId(item.id)}
                          type="button"
                        >
                          <div className={styles.bankImportListItemTop}>
                            <div className={styles.bankImportListItemName}>{item.rawLabel}</div>
                            <div className={styles.bankImportAmount}>
                              {formatSignedCurrency(item.amount * (item.entryType === "expense" ? -1 : 1))}
                            </div>
                          </div>
                          <div className={styles.bankImportListItemMeta}>
                            <span className={styles.txMetaItem}>{item.date || "Uten dato"}</span>
                            <span className={styles.txMetaItem}>{item.paymentType}</span>
                            <span className={styles.txMetaItem}>{item.confidenceScore}% sikker</span>
                          </div>
                          <div className={styles.bankImportListItemStatus}>
                            {reviewStatusText(item, decision)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.bankImportDetailPane}>
                  <div className={styles.bankImportPaneTitle}>Valg for valgt rad</div>

                  <div className={styles.bankImportDetailHeader}>
                    <div>
                      <div className={styles.bankImportDetailName}>{selectedItem.rawLabel}</div>
                      <div className={styles.bankImportDetailSub}>{selectedItem.normalizedLabel}</div>
                    </div>
                    <div className={styles.bankImportAmount}>
                      {formatSignedCurrency(
                        selectedItem.amount * (selectedItem.entryType === "expense" ? -1 : 1)
                      )}
                    </div>
                  </div>

                  <div className={styles.bankImportMetaRow}>
                    <span className={styles.txMetaItem}>{selectedItem.date || "Uten dato"}</span>
                    <span className={styles.txMetaItem}>{selectedItem.paymentType}</span>
                    <span className={styles.txMetaItem}>{selectedItem.confidenceScore}% sikker</span>
                    <span className={styles.txMetaItem}>{transactionKindLabel(selectedItem.transactionKind)}</span>
                  </div>

                  <div className={styles.bankImportReason}>{selectedItem.reviewReason}</div>

                  <div className={styles.bankImportDecisionHint}>
                    Behold hovedvalget enkelt her. Bruk flere valg bare når forslaget trenger korreksjon.
                  </div>

                  <div className={styles.bankImportActionGrid}>
                    {ACTION_OPTIONS.filter(
                      (option) => option.value !== "link_existing" || Boolean(selectedItem.suggestedMatch)
                    ).map((option) => (
                      <button
                        key={option.value}
                        className={cx(
                          styles.bankImportActionButton,
                          option.className,
                          selectedDecision.action === option.value && styles.bankImportActionButtonActive
                        )}
                        onClick={() =>
                          updateDecision(selectedItem.id, {
                            action: option.value,
                            recurringAction: option.value === "import_new" ? selectedDecision.recurringAction : "none",
                            ...(option.value === "link_existing" && selectedItem.suggestedMatch
                              ? { matchEntryId: selectedItem.suggestedMatch.entryId }
                              : {})
                          })
                        }
                        type="button"
                      >
                        <span className={styles.bankImportActionLabel}>{option.label}</span>
                        <span className={styles.bankImportActionDescription}>{option.description}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.bankImportPrimaryFields}>
                    {selectedDecision.action === "link_existing" && selectedItem.suggestedMatch ? (
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Treff</label>
                        <select
                          className={styles.select}
                          onChange={(event) =>
                            updateDecision(selectedItem.id, { matchEntryId: event.target.value || null })
                          }
                          value={selectedDecision.matchEntryId ?? selectedItem.suggestedMatch.entryId}
                        >
                          <option value={selectedItem.suggestedMatch.entryId}>
                            {selectedItem.suggestedMatch.entryName} ({selectedItem.suggestedMatch.score})
                          </option>
                        </select>
                      </div>
                    ) : null}

                    {selectedDecision.action === "import_new" ? (
                      <div className={styles.bankImportFieldGrid}>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Type</label>
                          <select
                            className={styles.select}
                            onChange={(event) =>
                              updateDecision(selectedItem.id, { type: event.target.value as EntryType })
                            }
                            value={selectedDecision.type}
                          >
                            <option value="expense">Utgift</option>
                            <option value="income">Inntekt</option>
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Transaksjonstype</label>
                          <select
                            className={styles.select}
                            onChange={(event) =>
                              updateDecision(selectedItem.id, {
                                transactionKind: event.target.value as BankTransactionKind
                              })
                            }
                            value={selectedDecision.transactionKind}
                          >
                            {TRANSACTION_KIND_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Kategori</label>
                          <select
                            className={styles.select}
                            onChange={(event) => updateDecision(selectedItem.id, { cat: event.target.value })}
                            value={selectedDecision.cat}
                          >
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Tilhører</label>
                          <select
                            className={styles.select}
                            onChange={(event) =>
                              updateDecision(selectedItem.id, { workspaceId: event.target.value || null })
                            }
                            value={selectedWorkspaceValue}
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
                  </div>

                  {selectedDecision.action === "import_new" ? (
                    <div className={styles.bankImportRecurringSection}>
                      <div className={styles.bankImportRecurringHeader}>
                        <div>
                          <div className={styles.bankImportPanelLabel}>Fast post</div>
                          <div className={styles.bankImportRecurringStatus}>
                            {selectedDecision.recurringAction === "link" && selectedRecurringItem
                              ? `Kobles til ${recurringLabelForEntryType(selectedItem.entryType)}: ${selectedRecurringItem.name}`
                              : selectedDecision.recurringAction === "create"
                                ? `Oppretter ny ${recurringLabelForEntryType(selectedItem.entryType)}`
                                : selectedRecommendedRecurringMatch
                                  ? `Vi fant sannsynlig ${recurringLabelForEntryType(selectedItem.entryType)}`
                                  : `Ingen ${recurringLabelForEntryType(selectedItem.entryType)} funnet`}
                          </div>
                        </div>
                        {!recurringPanelVisible ? (
                          <button
                            className={styles.bankImportAdvancedToggle}
                            onClick={() => setRecurringPanelOpen(true)}
                            type="button"
                          >
                            Avklar fast post
                          </button>
                        ) : null}
                      </div>

                      {recurringPanelVisible ? (
                        <div className={styles.bankImportRecurringBody}>
                          <div className={styles.bankImportRecurringPrimary}>
                            <div className={styles.bankImportHint}>
                              {selectedRecommendedRecurringMatch
                                ? `${selectedRecommendedRecurringMatch.itemName} matcher navn, beløp og prosjekt best.`
                                : `Du kan fortsatt opprette eller koble denne raden til en ${recurringLabelForEntryType(selectedItem.entryType)}.`}
                            </div>
                            <div className={styles.bankImportRecurringPrimaryActions}>
                              {selectedRecommendedRecurringMatch ? (
                                <button
                                  className={styles.modalPrimary}
                                  onClick={() =>
                                    updateDecision(selectedItem.id, {
                                      recurringAction: "link",
                                      recurringItemId: selectedRecommendedRecurringMatch.itemId
                                    })
                                  }
                                  type="button"
                                >
                                  Koble til {selectedRecommendedRecurringMatch.itemName}
                                </button>
                              ) : (
                                <button
                                  className={styles.modalPrimary}
                                  onClick={() =>
                                    updateDecision(selectedItem.id, {
                                      recurringAction: "create"
                                    })
                                  }
                                  type="button"
                                >
                                  Opprett ny {recurringLabelForEntryType(selectedItem.entryType)}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className={styles.recurringSecondarySection}>
                            <div className={styles.recurringSecondaryLabel}>Andre valg</div>
                            <div className={styles.recurringSecondaryActions}>
                              {selectedRecurringCandidates.length > 0 ? (
                                <button
                                  className={styles.modalCancel}
                                  onClick={() =>
                                    updateDecision(selectedItem.id, {
                                      recurringAction: selectedDecision.recurringAction === "link" ? "none" : "link",
                                      recurringItemId:
                                        selectedDecision.recurringItemId ??
                                        selectedRecommendedRecurringMatch?.itemId ??
                                        selectedRecurringCandidates[0]?.id ??
                                        null
                                    })
                                  }
                                  type="button"
                                >
                                  Velg en annen {recurringLabelForEntryType(selectedItem.entryType)}
                                </button>
                              ) : null}
                              <button
                                className={styles.modalCancel}
                                onClick={() =>
                                  updateDecision(selectedItem.id, {
                                    recurringAction: selectedDecision.recurringAction === "create" ? "none" : "create"
                                  })
                                }
                                type="button"
                              >
                                Opprett ny {recurringLabelForEntryType(selectedItem.entryType)}
                              </button>
                            </div>

                            {selectedDecision.recurringAction === "link" ? (
                              <div className={styles.recurringSecondaryPanel}>
                                <div className={styles.field}>
                                  <label className={styles.fieldLabel}>Velg fast post</label>
                                  <select
                                    className={styles.select}
                                    onChange={(event) =>
                                      updateDecision(selectedItem.id, { recurringItemId: event.target.value || null })
                                    }
                                    value={selectedDecision.recurringItemId ?? ""}
                                  >
                                    <option value="" disabled>
                                      Velg fast post
                                    </option>
                                    {selectedRecurringCandidates.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.name} · {item.cat}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : null}

                            {selectedDecision.recurringAction === "create" ? (
                              <div className={styles.recurringSecondaryPanel}>
                                <div className={styles.bankImportFieldGrid}>
                                  <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Navn på fast post</label>
                                    <input
                                      className={styles.input}
                                      onChange={(event) =>
                                        updateDecision(selectedItem.id, { recurringName: event.target.value })
                                      }
                                      value={selectedDecision.recurringName}
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Kategori</label>
                                    <select
                                      className={styles.select}
                                      onChange={(event) =>
                                        updateDecision(selectedItem.id, {
                                          recurringCat: event.target.value,
                                          cat: event.target.value
                                        })
                                      }
                                      value={selectedDecision.recurringCat}
                                    >
                                      {CATEGORIES.map((category) => (
                                        <option key={category} value={category}>
                                          {category}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label className={styles.fieldLabel}>Tilhører</label>
                                    <select
                                      className={styles.select}
                                      onChange={(event) =>
                                        updateDecision(selectedItem.id, {
                                          recurringWorkspaceId: event.target.value || null,
                                          workspaceId: event.target.value || null
                                        })
                                      }
                                      value={selectedRecurringWorkspaceValue}
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
                                    <label className={styles.fieldLabel}>Dag i måneden</label>
                                    <input
                                      className={styles.input}
                                      max="31"
                                      min="1"
                                      onChange={(event) =>
                                        updateDecision(selectedItem.id, {
                                          recurringDayOfMonth: Number(event.target.value)
                                        })
                                      }
                                      step="1"
                                      type="number"
                                      value={selectedDecision.recurringDayOfMonth}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className={styles.bankImportAdvanced}>
                    <button
                      className={styles.bankImportAdvancedToggle}
                      onClick={() => setAdvancedOpen((current) => !current)}
                      type="button"
                    >
                      {advancedOpen ? "Skjul flere valg" : "Flere valg"}
                    </button>

                    {advancedOpen ? (
                      <div className={styles.bankImportAdvancedPanel}>
                        {selectedItem.suggestedMatch ? (
                          <div className={styles.bankImportHint}>
                            Eksisterende forslag: {selectedItem.suggestedMatch.entryName} ({selectedItem.suggestedMatch.cat})
                          </div>
                        ) : null}

                        {selectedItem.suggestion ? (
                          <div className={styles.bankImportHint}>
                            Læringsforslag: {selectedItem.suggestion.cat}
                            {selectedItem.suggestion.workspaceId
                              ? ` · ${workspaces.find((workspace) => workspace.id === selectedItem.suggestion?.workspaceId)?.name ?? "Ukjent prosjekt"}`
                              : ""}
                            {` · ${transactionKindLabel(selectedItem.suggestion.transactionKind)}`}
                          </div>
                        ) : null}

                        <div className={styles.bankImportHint}>
                          Bokføringsregel: {selectedItem.reportingTreatment}
                        </div>

                        {selectedItem.linkSuggestions.length > 0 ? (
                          <div className={styles.bankImportLinkSection}>
                            <div className={styles.bankImportPanelLabel}>Relaterte transaksjoner / nulling</div>
                            {selectedItem.linkSuggestions.map((link) => (
                              <div key={link.id} className={styles.bankImportLinkRow}>
                                <div>
                                  <div className={styles.bankImportLinkTitle}>
                                    {link.linkKind === "vipps_offset" ? "Vipps mellomledd" : "Overføring"}
                                  </div>
                                  <div className={styles.bankImportHint}>
                                    {link.otherRawLabel} ({link.confidenceScore}%)
                                  </div>
                                </div>
                                <select
                                  className={styles.select}
                                  onChange={(event) =>
                                    setLinkDecisions((current) => ({
                                      ...current,
                                      [link.id]: event.target.value as BankTransactionLinkStatus
                                    }))
                                  }
                                  value={linkDecisions[link.id] ?? link.status}
                                >
                                  <option value="confirmed">Godkjenn nulling</option>
                                  <option value="rejected">Avvis nulling</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className={styles.bankImportAdvancedActions}>
                          <button
                            className={styles.modalCancel}
                            disabled={busy || applying}
                            onClick={() => handleCreateKnownRule(selectedItem)}
                            type="button"
                          >
                            Gjør kjent regel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.bankImportEmptyState}>
                <div className={styles.bankImportIntroTitle}>Ingen review-rader lastet ennå</div>
                <div className={styles.bankImportIntroText}>
                  Gå tilbake og parse filen på nytt hvis du forventet rader her.
                </div>
              </div>
            )}

            <div className={styles.bankImportFooter}>
              <button
                className={styles.modalCancel}
                disabled={busy || applying}
                onClick={() => setStep("upload")}
                type="button"
              >
                Tilbake
              </button>
              <button className={styles.modalCancel} disabled={applying || !batchId} onClick={() => batchId && loadReview(batchId)} type="button">
                Last inn på nytt
              </button>
              <button className={styles.modalPrimary} disabled={applying || !summary} onClick={handleApply} type="button">
                {applying ? "Importer..." : `Godkjenn forslag (${decisionCount})`}
              </button>
            </div>
          </div>
        )}

        {status ? <div className={styles.statusText}>{status}</div> : null}
      </div>
    </div>
  );
}
