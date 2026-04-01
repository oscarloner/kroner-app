import type { Entry, EntryType, RecurringItem, RecurringMatchCandidate, RecurringType } from "@/lib/types";

function normalizeComparableName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function recurringTypeForEntryType(type: EntryType): RecurringType {
  return type === "income" ? "fixed" : "sub";
}

function scoreRecurringMatch(args: { entryName: string; item: RecurringItem; amount: number; workspaceId: string | null }) {
  let score = 0;

  if (Math.abs(args.item.amount - args.amount) < 0.001) {
    score += 55;
  } else {
    return 0;
  }

  if (args.item.workspaceId === args.workspaceId) {
    score += 20;
  } else if (!args.item.workspaceId || !args.workspaceId) {
    score += 8;
  }

  const normalizedEntryName = normalizeComparableName(args.entryName);
  const normalizedRecurringName = normalizeComparableName(args.item.name);

  if (normalizedEntryName === normalizedRecurringName) {
    score += 30;
  } else if (
    normalizedEntryName.includes(normalizedRecurringName) ||
    normalizedRecurringName.includes(normalizedEntryName)
  ) {
    score += 18;
  }

  return Math.min(100, score);
}

export function findRecommendedRecurringMatch(args: {
  entryType: EntryType;
  entryName: string;
  amount: number;
  workspaceId: string | null;
  recurringItems: RecurringItem[];
  existingRecurringItemId?: string | null;
}): RecurringMatchCandidate | null {
  if (args.existingRecurringItemId) {
    return null;
  }

  const expectedType = recurringTypeForEntryType(args.entryType);
  let bestMatch: RecurringMatchCandidate | null = null;

  for (const item of args.recurringItems) {
    if (item.type !== expectedType) {
      continue;
    }

    const score = scoreRecurringMatch({
      entryName: args.entryName,
      item,
      amount: args.amount,
      workspaceId: args.workspaceId
    });

    if (score < 68) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        itemId: item.id,
        itemName: item.name,
        score,
        cat: item.cat,
        workspaceId: item.workspaceId,
        type: item.type
      };
    }
  }

  return bestMatch;
}

export function attachRecurringRecommendations(entries: Entry[], recurringItems: RecurringItem[]) {
  return entries.map((entry) => ({
    ...entry,
    recommendedRecurringMatch:
      entry.sourceKind === "recurring" || entry.isProjected
        ? null
        : findRecommendedRecurringMatch({
            entryType: entry.type,
            entryName: entry.name,
            amount: entry.amount,
            workspaceId: entry.workspaceId ?? null,
            recurringItems,
            existingRecurringItemId: entry.recurringItemId ?? null
          })
  }));
}
