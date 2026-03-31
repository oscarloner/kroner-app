import { CATEGORIES, type AiSuggestion, type OcrSuggestion, type Workspace } from "@/lib/types";

export type AiLearningExample = {
  name: string;
  type: "income" | "expense" | "fixed";
  cat: string;
  workspaceName?: string | null;
};

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

function normalizeLearningName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreLearningExample(name: string, example: AiLearningExample) {
  const target = normalizeLearningName(name);
  const candidate = normalizeLearningName(example.name);

  if (!target || !candidate) {
    return 0;
  }

  if (target === candidate) {
    return 100;
  }

  if (target.includes(candidate) || candidate.includes(target)) {
    return 80;
  }

  const targetTokens = new Set(target.split(" "));
  const candidateTokens = new Set(candidate.split(" "));
  let overlap = 0;

  for (const token of targetTokens) {
    if (token.length > 1 && candidateTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap * 20;
}

export function selectRelevantLearningExamples(
  name: string,
  examples: AiLearningExample[],
  limit = 8
) {
  return examples
    .map((example) => ({ example, score: scoreLearningExample(name, example) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.example);
}

export function summarizeLearningExamples(examples: AiLearningExample[], limit = 12) {
  const grouped = new Map<string, { count: number; example: AiLearningExample }>();

  for (const example of examples) {
    const key = [
      normalizeLearningName(example.name),
      example.type,
      example.cat,
      example.workspaceName ?? ""
    ].join("|");
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, { count: 1, example });
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ count, example }) => {
      const workspace = example.workspaceName ? `, konto=${example.workspaceName}` : "";
      const countLabel = count > 1 ? `, brukt ${count} ganger` : "";
      return `${example.name} -> type=${example.type}, kategori=${example.cat}${workspace}${countLabel}`;
    });
}

function buildLearningSection(lines: string[]) {
  if (lines.length === 0) {
    return "";
  }

  return [
    "Lær av historikken i dette regnskapet.",
    "Hvis samme eller svært lik tekst finnes i eksemplene, prioriter samme type, kategori og konto.",
    `Historiske eksempler: ${lines.join(" | ")}.`
  ].join(" ");
}

export function buildCategorizeSystem(workspaces: Workspace[], learningExamples: AiLearningExample[] = []) {
  return [
    "Norsk økonomiassistent. Svar KUN med JSON.",
    'Eksempel: {"type":"expense","cat":"Programvare & verktøy","ws":"applaus"}',
    "Type: income/expense/fixed.",
    `Kategorier: ${CATEGORIES.join(", ")}.`,
    `Kontoer: ${workspaces
      .map((workspace) => `${workspace.name}(${workspace.legacyId ?? workspace.id})`)
      .join(", ")}.`,
    buildLearningSection(
      learningExamples.map((example) => {
        const workspace = example.workspaceName ? `, konto=${example.workspaceName}` : "";
        return `${example.name} -> type=${example.type}, kategori=${example.cat}${workspace}`;
      })
    )
  ].join(" ");
}

export function buildOcrSystem(workspaces: Workspace[], learningExamples: AiLearningExample[] = []) {
  return [
    "Norsk økonomiassistent. Les kvittering eller faktura. Svar KUN med JSON.",
    '{"name":"...","amount":0,"date":"YYYY-MM-DD","cat":"...","type":"income eller expense","ws":"..."}',
    `Kategorier: ${CATEGORIES.join(", ")}.`,
    `Kontoer: ${workspaces
      .map((workspace) => `${workspace.name}(${workspace.legacyId ?? workspace.id})`)
      .join(", ")}.`,
    buildLearningSection(summarizeLearningExamples(learningExamples)),
    "Hvis du er usikker, svar med et tomt JSON-objekt."
  ].join(" ");
}

export function normalizeCategorizeResponse(value: AiSuggestion): AiSuggestion {
  return {
    type: value.type === "sub" ? "fixed" : value.type,
    cat: value.type === "sub" ? "Abonnementer" : value.cat,
    ws: value.ws
  };
}

export function normalizeOcrResponse(value: OcrSuggestion): OcrSuggestion {
  return {
    name: value.name,
    amount: value.amount,
    date: value.date,
    cat: value.type === "sub" ? "Abonnementer" : value.cat,
    type: value.type === "sub" ? "fixed" : value.type,
    ws: value.ws
  };
}
