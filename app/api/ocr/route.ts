import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import {
  type AiLearningExample,
  buildOcrSystem,
  callAnthropic,
  normalizeOcrResponse,
  parseAiJson
} from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { OcrSuggestion, Workspace } from "@/lib/types";

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

export async function POST(request: Request) {
  try {
    const { image, mediaType, accountId } = (await request.json()) as {
      image?: string;
      mediaType?: string;
      accountId?: string;
    };

    if (!image || !mediaType) {
      return NextResponse.json({ message: "Missing image payload." }, { status: 400 });
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

    const [entriesRes, recurringRes] = await Promise.all([
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
        .limit(100)
    ]);

    if (entriesRes.error) {
      throw entriesRes.error;
    }

    if (recurringRes.error) {
      throw recurringRes.error;
    }

    const learningExamples: AiLearningExample[] = [
      ...(entriesRes.data ?? []).map((row) => toLearningExample(row, workspaceNames)),
      ...(recurringRes.data ?? []).map((row) => toLearningExample(row, workspaceNames))
    ];

    const json = await callAnthropic({
      body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: buildOcrSystem(normalizedWorkspaces, learningExamples),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: image
                }
              },
              {
                type: "text",
                text: "Les kvitteringen."
              }
            ]
          }
        ]
      }
    });

    const suggestion = normalizeOcrResponse(
      parseAiJson<OcrSuggestion>(json.content?.[0]?.text)
    );

    return NextResponse.json(suggestion);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "OCR failed."
      },
      { status: 500 }
    );
  }
}
