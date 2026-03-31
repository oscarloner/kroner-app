"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/kroner.module.css";
import { CATEGORIES, type Workspace } from "@/lib/types";

type Suggestion = {
  type?: "income" | "expense" | "sub" | "fixed";
  cat?: string;
  ws?: string;
};

type OcrResult = Suggestion & {
  name?: string;
  amount?: number;
  date?: string;
};

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AddModal({
  accountId,
  workspaces,
  currentWorkspaceId,
  open,
  onClose
}: {
  accountId: string;
  workspaces: Workspace[];
  currentWorkspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [type, setType] = useState<"income" | "expense" | "sub" | "fixed">("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string>(CATEGORIES[4]);
  const [workspaceId, setWorkspaceId] = useState(
    currentWorkspaceId === "all" ? workspaces[0]?.id ?? "" : currentWorkspaceId
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrPreview, setOcrPreview] = useState("");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const aiTimeout = useRef<number | null>(null);

  function resolveWorkspace(raw?: string) {
    if (!raw) {
      return undefined;
    }

    return workspaces.find((workspace) => workspace.id === raw || workspace.legacyId === raw)?.id;
  }

  function applySuggestion(value: Suggestion | OcrResult) {
    if (value.type) {
      setType(value.type);
    }
    if (value.cat) {
      setCat(value.cat);
    }
    const resolvedWorkspaceId = resolveWorkspace(value.ws);
    if (resolvedWorkspaceId) {
      setWorkspaceId(resolvedWorkspaceId);
    }
    if ("name" in value && value.name) {
      setName(value.name);
    }
    if ("amount" in value && typeof value.amount === "number") {
      setAmount(String(value.amount));
    }
    if ("date" in value && value.date) {
      setDate(value.date);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (name.trim().length < 3 || !open) {
      setSuggestion(null);
      setAiBusy(false);
      if (aiTimeout.current) {
        window.clearTimeout(aiTimeout.current);
      }
      return;
    }

    if (aiTimeout.current) {
      window.clearTimeout(aiTimeout.current);
    }

    aiTimeout.current = window.setTimeout(async () => {
      setAiBusy(true);

      try {
        const response = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, name })
        });

        if (!response.ok) {
          throw new Error();
        }

        const json = (await response.json()) as Suggestion;
        setSuggestion(!json.type && !json.cat && !json.ws ? null : json);
      } catch {
        setSuggestion(null);
      } finally {
        setAiBusy(false);
      }
    }, 600);

    return () => {
      if (aiTimeout.current) {
        window.clearTimeout(aiTimeout.current);
      }
    };
  }, [accountId, name, open]);

  async function handleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== "string") {
        return;
      }

      setOcrPreview(result);
      setOcrBusy(true);
      setOcrResult(null);
      setStatus("");

      try {
        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            image: result.split(",")[1],
            mediaType: file.type
          })
        });

        const json = (await response.json()) as OcrResult & { message?: string };
        if (!response.ok) {
          throw new Error(json.message || "OCR feilet.");
        }

        setOcrResult(json);
        applySuggestion(json);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "OCR feilet.");
      } finally {
        setOcrBusy(false);
      }
    };

    reader.readAsDataURL(file);
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
          date,
          link,
          note
        })
      });

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke lagre.");
      }

      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke lagre.");
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

  const recurring = type === "sub" || type === "fixed";
  const suggestionWorkspace = workspaces.find(
    (workspace) => workspace.id === resolveWorkspace(suggestion?.ws)
  );

  return (
    <div className={cx(styles.overlay, styles.overlayOpen)} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalTitle}>Legg til transaksjon</div>

        <form onSubmit={handleSubmit}>
          <div className={styles.typeRow}>
            {[
              { value: "income", label: "↑ Inntekt", className: styles.typePillIncome },
              { value: "expense", label: "↓ Utgift", className: styles.typePillExpense },
              { value: "sub", label: "↻ Abonnement", className: styles.typePillSub },
              { value: "fixed", label: "★ Fast inntekt", className: styles.typePillFixed }
            ].map((item) => (
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

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Navn</label>
            <input
              className={styles.input}
              onChange={(event) => setName(event.target.value)}
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

          <div className={styles.cameraWrap}>
            <input
              accept="image/*"
              capture="environment"
              className={styles.cameraInput}
              onChange={handleImage}
              type="file"
            />
            {ocrPreview ? <img alt="OCR preview" className={styles.cameraPreview} src={ocrPreview} /> : null}
            <div className={styles.cameraLabel}>
              {ocrBusy ? "Claude leser bildet..." : "Ta bilde av kvittering eller velg fra galleri"}
            </div>
          </div>

          {ocrResult ? (
            <div className={styles.aiBox}>
              <div className={styles.aiBoxLabel}>Funnet i bildet</div>
              <div className={styles.aiBoxRow}>
                {ocrResult.name ? <span className={styles.aiChip}>{ocrResult.name}</span> : null}
                {typeof ocrResult.amount === "number" ? (
                  <span className={styles.aiChip}>{ocrResult.amount} kr</span>
                ) : null}
                {ocrResult.date ? <span className={styles.aiChip}>{ocrResult.date}</span> : null}
                {ocrResult.cat ? <span className={styles.aiChip}>{ocrResult.cat}</span> : null}
              </div>
            </div>
          ) : null}

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
            {!recurring ? (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Dato</label>
                <input
                  className={styles.input}
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  value={date}
                />
              </div>
            ) : null}
          </div>

          <div className={styles.fieldRow}>
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
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Konto</label>
              <select
                className={styles.select}
                onChange={(event) => setWorkspaceId(event.target.value)}
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

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Lenke</label>
            <input className={styles.input} onChange={(event) => setLink(event.target.value)} value={link} />
          </div>

          {!recurring ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Notat</label>
              <textarea
                className={styles.textarea}
                onChange={(event) => setNote(event.target.value)}
                value={note}
              />
            </div>
          ) : null}

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
