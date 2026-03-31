import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import {
  buildCategorizeSystem,
  callAnthropic,
  normalizeCategorizeResponse,
  parseAiJson
} from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { AiSuggestion, Workspace } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { name, accountId } = (await request.json()) as {
      name?: string;
      accountId?: string;
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

    const json = await callAnthropic({
      body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 120,
        system: buildCategorizeSystem(normalizedWorkspaces),
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
