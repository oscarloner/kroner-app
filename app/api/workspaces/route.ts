import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function POST(request: Request) {
  try {
    const { accountId, name, color } = (await request.json()) as {
      accountId?: string;
      name?: string;
      color?: string;
    };

    const account = await requireAccountAccess(accountId);

    if (!name?.trim()) {
      return NextResponse.json({ message: "Missing workspace name." }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from("workspaces").insert({
      account_id: account.accountId,
      created_by: account.user.id,
      legacy_id: `${slugify(name)}-${Date.now()}`,
      name: name.trim(),
      color: color || "#787774"
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "Workspace opprettet." });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not create workspace."
      },
      { status: 500 }
    );
  }
}
