import { CATEGORIES, type AiSuggestion, type OcrSuggestion, type Workspace } from "@/lib/types";

function extractJson(text: string) {
  return text.replace(/```json|```/g, "").trim();
}

export function parseAiJson<T>(value: unknown): T {
  if (typeof value !== "string") {
    return {} as T;
  }

  try {
    return JSON.parse(extractJson(value)) as T;
  } catch {
    return {} as T;
  }
}

export async function callAnthropic({
  body
}: {
  body: Record<string, unknown>;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Anthropic request failed.");
  }

  return response.json();
}

export function buildCategorizeSystem(workspaces: Workspace[]) {
  return [
    "Norsk økonomiassistent. Svar KUN med JSON.",
    'Eksempel: {"type":"expense","cat":"Programvare & verktøy","ws":"applaus"}',
    "Type: income/expense/sub/fixed.",
    `Kategorier: ${CATEGORIES.join(", ")}.`,
    `Kontoer: ${workspaces
      .map((workspace) => `${workspace.name}(${workspace.legacyId ?? workspace.id})`)
      .join(", ")}.`
  ].join(" ");
}

export function buildOcrSystem(workspaces: Workspace[]) {
  return [
    "Norsk økonomiassistent. Les kvittering eller faktura. Svar KUN med JSON.",
    '{"name":"...","amount":0,"date":"YYYY-MM-DD","cat":"...","type":"income eller expense","ws":"..."}',
    `Kategorier: ${CATEGORIES.join(", ")}.`,
    `Kontoer: ${workspaces
      .map((workspace) => `${workspace.name}(${workspace.legacyId ?? workspace.id})`)
      .join(", ")}.`,
    "Hvis du er usikker, svar med et tomt JSON-objekt."
  ].join(" ");
}

export function normalizeCategorizeResponse(value: AiSuggestion): AiSuggestion {
  return {
    type: value.type,
    cat: value.cat,
    ws: value.ws
  };
}

export function normalizeOcrResponse(value: OcrSuggestion): OcrSuggestion {
  return {
    name: value.name,
    amount: value.amount,
    date: value.date,
    cat: value.cat,
    type: value.type,
    ws: value.ws
  };
}
