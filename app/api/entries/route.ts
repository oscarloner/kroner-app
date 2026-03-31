import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const {
      accountId,
      name,
      amount,
      type,
      cat,
      workspaceId,
      dayOfMonth,
      date,
      link,
      note
    } = (await request.json()) as {
      accountId?: string;
      name?: string;
      amount?: number;
      type?: "income" | "expense" | "sub" | "fixed";
      cat?: string;
      workspaceId?: string;
      dayOfMonth?: number;
      date?: string;
      link?: string;
      note?: string;
    };

    const account = await requireAccountAccess(accountId);

    if (!name?.trim()) {
      return NextResponse.json({ message: "Missing name." }, { status: 400 });
    }

    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ message: "Invalid amount." }, { status: 400 });
    }

    if (!cat?.trim()) {
      return NextResponse.json({ message: "Missing category." }, { status: 400 });
    }

    if (!type) {
      return NextResponse.json({ message: "Missing type." }, { status: 400 });
    }

    const supabase = await createClient();
    const common = {
      account_id: account.accountId,
      created_by: account.user.id,
      name: name.trim(),
      amount,
      cat: cat.trim(),
      workspace_id: workspaceId || null,
      legacy_id: null,
      source_type: "manual",
      source_name: null,
      source_transaction_id: null,
      source_fingerprint: null,
      raw_name: null,
      payment_type: null,
      import_batch_id: null,
      match_status: "manual"
    };

    if (type === "sub" || type === "fixed") {
      if (
        typeof dayOfMonth !== "number" ||
        Number.isNaN(dayOfMonth) ||
        dayOfMonth < 1 ||
        dayOfMonth > 31
      ) {
        return NextResponse.json({ message: "Invalid recurring day." }, { status: 400 });
      }

      const { error } = await supabase.from("recurring_items").insert({
        ...common,
        type,
        link: link?.trim() || null,
        day_of_month: dayOfMonth
      });

      if (error) {
        throw error;
      }

      return NextResponse.json({ message: "Fast post lagret." });
    }

    const { error } = await supabase.from("entries").insert({
      ...common,
      type,
      date: date || new Date().toISOString().slice(0, 10),
      link: link?.trim() || null,
      note: note?.trim() || null
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "Transaksjon lagret." });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not create entry."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id, kind } = (await request.json()) as {
      id?: string;
      kind?: "entry" | "recurring";
    };

    if (!id || !kind) {
      return NextResponse.json({ message: "Missing id or kind." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const table = kind === "entry" ? "entries" : "recurring_items";

    const { data: row } = await supabase
      .from(table)
      .select("account_id")
      .eq("id", id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", row.account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ message: "No access." }, { status: 403 });
    }

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "Slettet." });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not delete entry."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const {
      id,
      kind,
      name,
      amount,
      cat,
      workspaceId,
      dayOfMonth,
      date,
      link,
      note
    } = (await request.json()) as {
      id?: string;
      kind?: "entry" | "recurring";
      name?: string;
      amount?: number;
      cat?: string;
      workspaceId?: string | null;
      dayOfMonth?: number;
      date?: string;
      link?: string;
      note?: string;
    };

    if (!id || !kind) {
      return NextResponse.json({ message: "Missing id or kind." }, { status: 400 });
    }

    if (!name?.trim()) {
      return NextResponse.json({ message: "Missing name." }, { status: 400 });
    }

    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ message: "Invalid amount." }, { status: 400 });
    }

    if (!cat?.trim()) {
      return NextResponse.json({ message: "Missing category." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const table = kind === "entry" ? "entries" : "recurring_items";

    const { data: row } = await supabase
      .from(table)
      .select("account_id")
      .eq("id", id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", row.account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ message: "No access." }, { status: 403 });
    }

    const updatePayload: {
      name: string;
      amount: number;
      cat: string;
      workspace_id: string | null;
      link: string | null;
      day_of_month?: number;
      date?: string;
      note?: string | null;
    } = {
      name: name.trim(),
      amount,
      cat: cat.trim(),
      workspace_id: workspaceId || null,
      link: link?.trim() || null
    };

    if (kind === "entry") {
      if (!date) {
        return NextResponse.json({ message: "Missing date." }, { status: 400 });
      }

      updatePayload.date = date;
      updatePayload.note = note?.trim() || null;
    } else {
      if (
        typeof dayOfMonth !== "number" ||
        Number.isNaN(dayOfMonth) ||
        dayOfMonth < 1 ||
        dayOfMonth > 31
      ) {
        return NextResponse.json({ message: "Invalid recurring day." }, { status: 400 });
      }

      updatePayload.day_of_month = dayOfMonth;
    }

    const { error } = await supabase.from(table).update(updatePayload).eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "Oppdatert." });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not update entry."
      },
      { status: 500 }
    );
  }
}
