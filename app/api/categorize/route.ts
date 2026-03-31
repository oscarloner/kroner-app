import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import {
  type AiBankLearningExample,
  type AiLearningExample,
  buildCategorizeSystem,
  callAnthropic,
  normalizeCategorizeResponse,
  parseAiJson,
  selectRelevantBankLearningExamples,
  selectRelevantLearningExamples
} from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { AiSuggestion, Workspace } from "@/lib/types";

function toLearningExample(
  row: {
    name: string;
    type: "income" | "expense" | "sub" | "fixed";
    cat: string;
    workspace_id: string | null;
  },
  workspaceNames: Map<string, string>
): AiLearningExample {
  return {
    name: row.name,
    type: row.type as "income" | "expense" | "sub" | "fixed",
    cat: row.cat,
    workspaceName: row.workspace_id ? workspaceNames.get(row.workspace_id) ?? null : null
  };
}

function toBankLearningExample(
  row: {
    raw_label: string;
    normalized_label: string;
    payment_type: string;
    entry_type: "income" | "expense";
    cat: string;
    workspace_id: string | null;
    usage_count: number;
  },
  workspaceNames: Map<string, string>
): AiBankLearningExample {
  return {
    rawLabel: row.raw_label,
    normalizedLabel: row.normalized_label,
    paymentType: row.payment_type,
    type: row.entry_type,
    cat: row.cat,
    workspaceName: row.workspace_id ? workspaceNames.get(row.workspace_id) ?? null : null,
    usageCount: row.usage_count
  };
}

export async function POST(request: Request) {
  try {
    const { name, accountId, rawName, normalizedName, paymentType } = (await request.json()) as {
      name?: string;
      accountId?: string;
      rawName?: string;
      normalizedName?: string;
      paymentType?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ message: "Missing name." }, { status: 400 });
    }

    const account = await requireAccountAccess(accountId);
    const supabase = await createClient();

    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("id, account_id, created_by, legacy_id, name, color")
      .eq("account_id", account.accountId);

    if (error) {
      throw error;
    }

    const normalizedWorkspaces: Workspace[] = (workspaces ?? []).map((workspace) => ({
      id: workspace.id,
      accountId: workspace.account_id,
      createdBy: workspace.created_by,
      legacyId: workspace.legacy_id,
      name: workspace.name,
      color: workspace.color
    }));
    const workspaceNames = new Map(normalizedWorkspaces.map((workspace) => [workspace.id, workspace.name]));

    const [entriesRes, recurringRes, bankLearningRes] = await Promise.all([
      supabase
        .from("entries")
        .select("name, type, cat, workspace_id")
        .eq("account_id", account.accountId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("recurring_items")
        .select("name, type, cat, workspace_id")
        .eq("account_id", account.accountId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("bank_learning_examples")
        .select("raw_label, normalized_label, payment_type, entry_type, cat, workspace_id, usage_count")
        .eq("account_id", account.accountId)
        .order("usage_count", { ascending: false })
        .limit(150)
    ]);

    if (entriesRes.error) {
      throw entriesRes.error;
    }

    if (recurringRes.error) {
      throw recurringRes.error;
    }

    if (bankLearningRes.error) {
      throw bankLearningRes.error;
    }

    const learningExamples: AiLearningExample[] = [
      ...(entriesRes.data ?? []).map((row) => toLearningExample(row, workspaceNames)),
      ...(recurringRes.data ?? []).map((row) => toLearningExample(row, workspaceNames))
    ];
    const relevantExamples = selectRelevantLearningExamples(name, learningExamples);
    const bankLearningExamples: AiBankLearningExample[] = (bankLearningRes.data ?? []).map((row) =>
      toBankLearningExample(row, workspaceNames)
    );
    const relevantBankExamples = selectRelevantBankLearningExamples(
      rawName?.trim() || name,
      normalizedName?.trim(),
      paymentType?.trim(),
      bankLearningExamples
    );

    const json = await callAnthropic({
      body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 120,
        system: buildCategorizeSystem(normalizedWorkspaces, relevantExamples, relevantBankExamples),
        messages: [{ role: "user", content: `Post: "${name}"` }]
      }
    });

    const suggestion = normalizeCategorizeResponse(
      parseAiJson<AiSuggestion>(json.content?.[0]?.text)
    );

    return NextResponse.json(suggestion);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Categorization failed."
      },
      { status: 500 }
    );
  }
}
