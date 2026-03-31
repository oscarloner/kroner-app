import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";

type EntryKind = "entry" | "recurring";
type EntryType = "income" | "expense";
type RecurringType = "sub" | "fixed";

function recurringTypeForEntryType(type: EntryType): RecurringType {
  return type === "income" ? "fixed" : "sub";
}

async function requireItemMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "entries" | "recurring_items",
  id: string,
  userId: string
) {
  const { data: row, error } = await supabase.from(table).select("account_id").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  if (!row) {
    return { error: NextResponse.json({ message: "Not found." }, { status: 404 }) };
  }

  const { data: membership } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", row.account_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return { error: NextResponse.json({ message: "No access." }, { status: 403 }) };
  }

  return { accountId: row.account_id };
}

export async function POST(request: Request) {
  try {
    const {
      accountId,
      name,
      amount,
      type,
      cat,
      workspaceId,
      sourceWorkspaceId,
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
      sourceWorkspaceId?: string | null;
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
        account_id: account.accountId,
        created_by: account.user.id,
        legacy_id: null,
        name: name.trim(),
        amount,
        cat: cat.trim(),
        workspace_id: workspaceId || null,
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
      source_workspace_id: sourceWorkspaceId || null,
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
    const { id, ids, kind } = (await request.json()) as {
      id?: string;
      ids?: string[];
      kind?: "entry" | "recurring";
    };

    const targetIds = Array.from(new Set([id, ...(ids ?? [])].filter((value): value is string => Boolean(value))));

    if (targetIds.length === 0 || !kind) {
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

    const { data: rows, error: rowsError } = await supabase
      .from(table)
      .select("account_id")
      .in("id", targetIds);

    if (rowsError) {
      throw rowsError;
    }

    if (!rows || rows.length !== targetIds.length) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }

    const accountIds = Array.from(new Set(rows.map((row) => row.account_id)));
    if (accountIds.length !== 1) {
      return NextResponse.json({ message: "Cannot delete across multiple accounts." }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", accountIds[0])
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ message: "No access." }, { status: 403 });
    }

    const { error } = await supabase.from(table).delete().in("id", targetIds);

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
      ids,
      kind,
      operation,
      name,
      amount,
      cat,
      workspaceId,
      sourceWorkspaceId,
      dayOfMonth,
      date,
      link,
      note,
      recurringItemId,
      recurringName,
      recurringCat,
      recurringWorkspaceId,
      recurringLink,
      recurringDayOfMonth
    } = (await request.json()) as {
      id?: string;
      ids?: string[];
      kind?: EntryKind;
      operation?: "link_recurring" | "unlink_recurring" | "create_recurring_from_entry";
      name?: string;
      amount?: number;
      cat?: string;
      workspaceId?: string | null;
      sourceWorkspaceId?: string | null;
      dayOfMonth?: number;
      date?: string;
      link?: string;
      note?: string;
      recurringItemId?: string | null;
      recurringName?: string;
      recurringCat?: string;
      recurringWorkspaceId?: string | null;
      recurringLink?: string;
      recurringDayOfMonth?: number;
    };

    const bulkTargetIds = Array.from(new Set((ids ?? []).filter((value): value is string => Boolean(value))));

    if (bulkTargetIds.length > 0) {
      if (kind !== "entry") {
        return NextResponse.json({ message: "Bulk update is only supported for entries." }, { status: 400 });
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

      const { data: rows, error: rowsError } = await supabase
        .from("entries")
        .select("id, account_id")
        .in("id", bulkTargetIds);

      if (rowsError) {
        throw rowsError;
      }

      if (!rows || rows.length !== bulkTargetIds.length) {
        return NextResponse.json({ message: "Not found." }, { status: 404 });
      }

      const accountIds = Array.from(new Set(rows.map((row) => row.account_id)));
      if (accountIds.length !== 1) {
        return NextResponse.json({ message: "Cannot update across multiple accounts." }, { status: 400 });
      }

      const { data: membership } = await supabase
        .from("account_members")
        .select("role")
        .eq("account_id", accountIds[0])
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json({ message: "No access." }, { status: 403 });
      }

      const { error } = await supabase
        .from("entries")
        .update({
          cat: cat.trim(),
          workspace_id: workspaceId || null
        })
        .in("id", bulkTargetIds);

      if (error) {
        throw error;
      }

      return NextResponse.json({ message: "Oppdatert." });
    }

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

    if (operation) {
      if (kind !== "entry") {
        return NextResponse.json({ message: "Recurring links can only be managed on entries." }, { status: 400 });
      }

      const membershipResult = await requireItemMembership(supabase, "entries", id, user.id);
      if (membershipResult.error) {
        return membershipResult.error;
      }

      const { data: entry, error: entryError } = await supabase
        .from("entries")
        .select("id, account_id, name, amount, type, cat, workspace_id, date, link")
        .eq("id", id)
        .maybeSingle();

      if (entryError) {
        throw entryError;
      }

      if (!entry) {
        return NextResponse.json({ message: "Not found." }, { status: 404 });
      }

      const expectedRecurringType = recurringTypeForEntryType(entry.type as EntryType);

      if (operation === "unlink_recurring") {
        const { error } = await supabase
          .from("entries")
          .update({ recurring_item_id: null })
          .eq("id", id)
          .eq("account_id", entry.account_id);

        if (error) {
          throw error;
        }

        return NextResponse.json({ message: "Kobling fjernet." });
      }

      if (operation === "link_recurring") {
        if (!recurringItemId) {
          return NextResponse.json({ message: "Missing recurring item." }, { status: 400 });
        }

        const { data: recurring, error: recurringError } = await supabase
          .from("recurring_items")
          .select("id, account_id, type")
          .eq("id", recurringItemId)
          .maybeSingle();

        if (recurringError) {
          throw recurringError;
        }

        if (!recurring || recurring.account_id !== entry.account_id) {
          return NextResponse.json({ message: "Fast post ikke funnet." }, { status: 404 });
        }

        if (recurring.type !== expectedRecurringType) {
          return NextResponse.json({ message: "Type mismatch between transaction and recurring item." }, { status: 400 });
        }

        const { error } = await supabase
          .from("entries")
          .update({ recurring_item_id: recurring.id })
          .eq("id", id)
          .eq("account_id", entry.account_id);

        if (error) {
          throw error;
        }

        return NextResponse.json({ message: "Koblet til fast post." });
      }

      const nextRecurringName = recurringName?.trim() || entry.name;
      const nextRecurringCat = recurringCat?.trim() || entry.cat;
      const nextRecurringWorkspaceId = recurringWorkspaceId ?? entry.workspace_id ?? null;
      const nextRecurringLink = recurringLink?.trim() || entry.link || null;
      const nextRecurringDay = recurringDayOfMonth ?? Number(String(entry.date).slice(8, 10));

      if (!nextRecurringName) {
        return NextResponse.json({ message: "Missing recurring name." }, { status: 400 });
      }

      if (!nextRecurringCat) {
        return NextResponse.json({ message: "Missing recurring category." }, { status: 400 });
      }

      if (
        typeof nextRecurringDay !== "number" ||
        Number.isNaN(nextRecurringDay) ||
        nextRecurringDay < 1 ||
        nextRecurringDay > 31
      ) {
        return NextResponse.json({ message: "Invalid recurring day." }, { status: 400 });
      }

      const { data: createdRecurring, error: createRecurringError } = await supabase
        .from("recurring_items")
        .insert({
          account_id: entry.account_id,
          created_by: user.id,
          legacy_id: null,
          name: nextRecurringName,
          amount: entry.amount,
          type: expectedRecurringType,
          cat: nextRecurringCat,
          workspace_id: nextRecurringWorkspaceId,
          link: nextRecurringLink,
          day_of_month: nextRecurringDay
        })
        .select("id")
        .single();

      if (createRecurringError || !createdRecurring) {
        throw createRecurringError ?? new Error("Could not create recurring item.");
      }

      const { error: linkEntryError } = await supabase
        .from("entries")
        .update({ recurring_item_id: createdRecurring.id })
        .eq("id", id)
        .eq("account_id", entry.account_id);

      if (linkEntryError) {
        throw linkEntryError;
      }

      return NextResponse.json({ message: "Opprettet og koblet fast post." });
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

    const table = kind === "entry" ? "entries" : "recurring_items";
    const membershipResult = await requireItemMembership(supabase, table, id, user.id);
    if (membershipResult.error) {
      return membershipResult.error;
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
      source_workspace_id?: string | null;
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
      updatePayload.source_workspace_id = sourceWorkspaceId || null;
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
