import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { buildOcrSystem, callAnthropic, normalizeOcrResponse, parseAiJson } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { OcrSuggestion, Workspace } from "@/lib/types";

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

    const json = await callAnthropic({
      body: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: buildOcrSystem(normalizedWorkspaces),
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
