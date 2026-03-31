"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";
import { CATEGORIES, type OcrSuggestion, type Workspace } from "@/lib/types";

type Suggestion = {
  type?: "income" | "expense" | "sub" | "fixed";
  cat?: string;
  ws?: string;
};

type AddType = "income" | "expense" | "sub" | "fixed";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeSuggestionType(type?: Suggestion["type"]): AddType | undefined {
  if (!type) return undefined;
  return type;
}

export function AddModal({
  accountId,
  workspaces,
  currentWorkspaceId,
  open,
  onClose,
  prefill,
  defaultType,
  allowedTypes
}: {
  accountId: string;
  workspaces: Workspace[];
  currentWorkspaceId: string;
  open: boolean;
  onClose: () => void;
  prefill?: OcrSuggestion | null;
  defaultType?: AddType;
  allowedTypes?: AddType[];
}) {
  const defaultWorkspaceId = currentWorkspaceId === "all" ? workspaces[0]?.id ?? "" : currentWorkspaceId;
  const availableTypes = allowedTypes && allowedTypes.length > 0 ? allowedTypes : ([
    "income",
    "expense",
    "sub",
    "fixed"
  ] as AddType[]);
  const resolvedDefaultType =
    (defaultType && availableTypes.includes(defaultType) ? defaultType : undefined) ??
    availableTypes[0] ??
    "expense";

  const [type, setType] = useState<AddType>(resolvedDefaultType);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string>(CATEGORIES[4]);
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const aiTimeout = useRef<number | null>(null);
  const prevOpen = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  function resolveWorkspace(raw?: string) {
    if (!raw) return undefined;
    return workspaces.find((w) => w.id === raw || w.legacyId === raw)?.id;
  }

  // Reset all fields (and apply prefill if any) each time the modal opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      const suggestedType = normalizeSuggestionType(prefill?.type);
      const nextType =
        suggestedType && availableTypes.includes(suggestedType) ? suggestedType : resolvedDefaultType;
      setType(nextType);
      setName(prefill?.name ?? "");
      setAmount(prefill?.amount != null ? String(prefill.amount) : "");
      setCat(prefill?.cat ?? CATEGORIES[4]);
      setWorkspaceId(resolveWorkspace(prefill?.ws) ?? defaultWorkspaceId);
      setDate(prefill?.date ?? new Date().toISOString().slice(0, 10));
      setDayOfMonth("1");
      setStatus("");
      setSuggestion(null);
      setBusy(false);
      setAiBusy(false);
    }
    prevOpen.current = open;
  }, [open, prefill, availableTypes, resolvedDefaultType]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [busy, open, onClose]);

  useEffect(() => {
    if (name.trim().length < 3 || !open) {
      setSuggestion(null);
      setAiBusy(false);
      if (aiTimeout.current) window.clearTimeout(aiTimeout.current);
      return;
    }

    if (aiTimeout.current) window.clearTimeout(aiTimeout.current);

    aiTimeout.current = window.setTimeout(async () => {
      setAiBusy(true);
      try {
        const response = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, name })
        });

        if (!response.ok) throw new Error();

        const json = (await response.json()) as Suggestion;
        setSuggestion(!json.type && !json.cat && !json.ws ? null : json);
      } catch {
        setSuggestion(null);
      } finally {
        setAiBusy(false);
      }
    }, 600);

    return () => {
      if (aiTimeout.current) window.clearTimeout(aiTimeout.current);
    };
  }, [accountId, name, open]);

  function applySuggestion(value: Suggestion) {
    const normalizedType = normalizeSuggestionType(value.type);
    if (normalizedType) setType(normalizedType);
    if (value.cat) {
      setCat(value.cat);
    }
    const resolvedId = resolveWorkspace(value.ws);
    if (resolvedId) setWorkspaceId(resolvedId);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          name,
          amount: Number(amount),
          type,
          cat,
          workspaceId: workspaceId || null,
          dayOfMonth: recurring ? Number(dayOfMonth) : undefined,
          date
        })
      });

      const json = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(json.message || "Kunne ikke lagre.");

      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke lagre.");
      setBusy(false);
    }
  }

  if (!open) return null;

  const recurring = type === "sub" || type === "fixed";
  const suggestionWorkspace = workspaces.find(
    (w) => w.id === resolveWorkspace(suggestion?.ws)
  );
  const typeOptions = [
    { value: "income", label: "↑ Inntekt", className: styles.typePillIncome },
    { value: "expense", label: "↓ Utgift", className: styles.typePillExpense },
    { value: "sub", label: "↻ Fast utgift", className: styles.typePillSub },
    { value: "fixed", label: "★ Fast inntekt", className: styles.typePillFixed }
  ].filter((item) => availableTypes.includes(item.value as AddType));

  return (
    <div
      className={cx(styles.overlay, styles.overlayOpen, styles.dialogOverlay, styles.fullScreenDialogOverlay)}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cx(styles.modal, styles.dialogModal, styles.fullScreenDialogModal)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalTitle}>Legg til transaksjon</div>

        <form className={styles.modalForm} onSubmit={handleSubmit} ref={formRef}>
          {typeOptions.length > 1 ? (
            <div className={styles.typeRow}>
              {typeOptions.map((item) => (
                <button
                  key={item.value}
                  className={cx(styles.typePill, type === item.value && item.className)}
                  onClick={() => setType(item.value as typeof type)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Navn</label>
            <input
              className={styles.input}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </div>

          {aiBusy || suggestion ? (
            <div className={styles.aiBox}>
              <div className={styles.aiBoxLabel}>AI-forslag</div>
              {aiBusy ? (
                <div className={styles.loadingText}>Analyserer...</div>
              ) : (
                <div className={styles.aiBoxRow}>
                  {suggestion?.type ? <span className={styles.aiChip}>{suggestion.type}</span> : null}
                  {suggestion?.cat ? <span className={styles.aiChip}>{suggestion.cat}</span> : null}
                  {suggestionWorkspace ? (
                    <span className={styles.aiChip}>{suggestionWorkspace.name}</span>
                  ) : null}
                  <div className={styles.aiActions}>
                    <button
                      className={styles.aiApprove}
                      onClick={() => suggestion && applySuggestion(suggestion)}
                      type="button"
                    >
                      Bruk
                    </button>
                    <button className={styles.aiReject} onClick={() => setSuggestion(null)} type="button">
                      Ignorer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Beløp</label>
              <input
                className={styles.input}
                min="0"
                onChange={(e) => setAmount(e.target.value)}
                required
                step="0.01"
                type="number"
                value={amount}
              />
            </div>
            {!recurring ? (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Dato</label>
                <input
                  className={cx(styles.input, styles.dateInput)}
                  onChange={(e) => setDate(e.target.value)}
                  type="date"
                  value={date}
                />
              </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Dag i måneden</label>
                <input
                  className={styles.input}
                  max="31"
                  min="1"
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  step="1"
                  type="number"
                  value={dayOfMonth}
                />
              </div>
            )}
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Kategori</label>
              <select className={styles.select} onChange={(e) => setCat(e.target.value)} value={cat}>
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
                onChange={(e) => setWorkspaceId(e.target.value)}
                value={workspaceId}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button className={styles.modalCancel} onClick={onClose} type="button">
              Avbryt
            </button>
            <button className={styles.modalPrimary} disabled={busy} type="submit">
              {busy ? "Lagrer..." : "Lagre"}
            </button>
          </div>
        </form>

        {status ? <div className={styles.statusText}>{status}</div> : null}
      </div>
    </div>
  );
}
