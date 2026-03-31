import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import type { LegacyImportPayload } from "@/lib/types";

function fallbackDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LegacyImportPayload;
    const account = await requireAccountAccess(payload.accountId);

    if (!["owner", "admin"].includes(account.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can replace account data." },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const user = account.user;

    const workspaces = payload.workspaces ?? [];

    await supabase.from("entries").delete().eq("account_id", account.accountId);
    await supabase.from("recurring_items").delete().eq("account_id", account.accountId);
    await supabase.from("workspaces").delete().eq("account_id", account.accountId);

    const workspaceRows = workspaces.map((workspace) => ({
      account_id: account.accountId,
      created_by: user.id,
      legacy_id: workspace.id,
      name: workspace.name,
      color: workspace.color
    }));

    const { data: insertedWorkspaces, error: workspaceError } = await supabase
      .from("workspaces")
      .insert(workspaceRows)
      .select("id, legacy_id");

    if (workspaceError) {
      throw workspaceError;
    }

    const workspaceMap = new Map(
      (insertedWorkspaces ?? []).map((workspace) => [workspace.legacy_id, workspace.id])
    );

    const entryRows = (payload.entries ?? [])
      .filter((entry) => entry.type === "income" || entry.type === "expense")
      .map((entry) => ({
        account_id: account.accountId,
        created_by: user.id,
        legacy_id: String(entry.id),
        name: entry.name,
        amount: entry.amount,
        type: entry.type,
        cat: entry.cat,
        workspace_id: workspaceMap.get(entry.ws) ?? null,
        date: entry.date || fallbackDate(),
        link: entry.link || null,
        note: entry.note || null
      }));

    const recurringRows = (payload.subs ?? [])
      .filter((item) => item.type === "sub" || item.type === "fixed")
      .map((item) => ({
        account_id: account.accountId,
        created_by: user.id,
        legacy_id: String(item.id),
        name: item.name,
        amount: item.amount,
        type: "fixed",
        cat: item.type === "sub" ? "Abonnementer" : item.cat,
        workspace_id: workspaceMap.get(item.ws) ?? null,
        link: item.link || null
      }));

    if (entryRows.length > 0) {
      const { error } = await supabase.from("entries").insert(entryRows);
      if (error) {
        throw error;
      }
    }

    if (recurringRows.length > 0) {
      const { error } = await supabase.from("recurring_items").insert(recurringRows);
      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      message: `Importerte ${entryRows.length} transaksjoner, ${recurringRows.length} faste poster og ${workspaceRows.length} workspaces.`
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Import failed."
      },
      { status: 500 }
    );
  }
}
