"use client";

import { useEffect, useRef, useState } from "react";
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

export function AddModal({
  accountId,
  workspaces,
  currentWorkspaceId
}: {
  accountId: string;
  workspaces: Workspace[];
  currentWorkspaceId: string;
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
  const [ocrPreview, setOcrPreview] = useState<string>("");
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
    if (name.trim().length < 3) {
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
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accountId,
            name
          })
        });

        if (!response.ok) {
          throw new Error();
        }

        const json = (await response.json()) as Suggestion;
        if (!json.type && !json.cat && !json.ws) {
          setSuggestion(null);
        } else {
          setSuggestion(json);
        }
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
  }, [accountId, name]);

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

      try {
        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accountId,
            image: result.split(",")[1],
            mediaType: file.type
          })
        });

        const json = (await response.json()) as OcrResult;

        if (!response.ok) {
          throw new Error(json && "message" in json ? String((json as { message?: string }).message) : "OCR feilet.");
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
        headers: {
          "Content-Type": "application/json"
        },
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

      setName("");
      setAmount("");
      setLink("");
      setNote("");
      setSuggestion(null);
      setOcrResult(null);
      setOcrPreview("");
      setStatus(json.message || "Lagret.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke lagre.");
    } finally {
      setBusy(false);
    }
  }

  const recurring = type === "sub" || type === "fixed";
  const suggestionWorkspace = workspaces.find(
    (workspace) => workspace.id === resolveWorkspace(suggestion?.ws)
  );

  return (
    <section className="panel">
      <div className="panelTitle">Legg til transaksjon</div>
      <form className="loginForm" onSubmit={handleSubmit}>
        <div className="typeRow">
          {[
            { value: "income", label: "↑ Inntekt" },
            { value: "expense", label: "↓ Utgift" },
            { value: "sub", label: "↻ Abonnement" },
            { value: "fixed", label: "★ Fast inntekt" }
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={item.value === type ? "typePill active" : "typePill"}
              onClick={() => setType(item.value as typeof type)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          className="textInput"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Hva gjelder dette?"
          required
        />

        {aiBusy || suggestion ? (
          <div className="aiBox">
            <div className="aiBoxLabel">Claude foreslår</div>
            {aiBusy ? (
              <div className="mutedText">Analyserer…</div>
            ) : (
              <div className="aiBoxRow">
                {suggestion?.type ? <span className="aiChip">{suggestion.type}</span> : null}
                {suggestion?.cat ? <span className="aiChip">{suggestion.cat}</span> : null}
                {suggestionWorkspace ? <span className="aiChip">{suggestionWorkspace.name}</span> : null}
                <div className="aiActions">
                  <button
                    className="approveButton"
                    type="button"
                    onClick={() => suggestion && applySuggestion(suggestion)}
                  >
                    Bruk
                  </button>
                  <button className="rejectButton" type="button" onClick={() => setSuggestion(null)}>
                    Ignorer
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="cameraWrap">
          <input
            className="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImage}
          />
          {ocrPreview ? <img className="cameraPreview" src={ocrPreview} alt="OCR preview" /> : null}
          <div className="cameraLabel">
            {ocrBusy ? "Claude leser bildet…" : "Ta bilde av kvittering eller velg fra galleri"}
          </div>
        </div>

        {ocrResult ? (
          <div className="aiBox">
            <div className="aiBoxLabel">Funnet i bildet</div>
            <div className="aiBoxRow">
              {ocrResult.name ? <span className="aiChip">{ocrResult.name}</span> : null}
              {typeof ocrResult.amount === "number" ? (
                <span className="aiChip">{ocrResult.amount} kr</span>
              ) : null}
              {ocrResult.date ? <span className="aiChip">{ocrResult.date}</span> : null}
              {ocrResult.cat ? <span className="aiChip">{ocrResult.cat}</span> : null}
            </div>
          </div>
        ) : null}

        <div className="fieldRow">
          <input
            className="textInput"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Beløp i kr"
            required
          />
          {!recurring ? (
            <input
              className="textInput"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          ) : null}
        </div>
        <div className="fieldRow">
          <select className="textInput" value={cat} onChange={(event) => setCat(event.target.value)}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className="textInput"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
        <input
          className="textInput"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="Lenke (valgfritt)"
        />
        {!recurring ? (
          <textarea
            className="textInput textAreaInput"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Notat (valgfritt)"
          />
        ) : null}
        <button className="primaryButton" type="submit" disabled={busy}>
          {busy ? "Lagrer..." : "Lagre"}
        </button>
      </form>
      {status ? <div className="statusText">{status}</div> : null}
    </section>
  );
}
