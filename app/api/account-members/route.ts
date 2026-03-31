import { NextResponse } from "next/server";
import { requireAccountAccess } from "@/lib/accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AccountRole } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { accountId, email, role } = (await request.json()) as {
      accountId?: string;
      email?: string;
      role?: AccountRole;
    };

    const account = await requireAccountAccess(accountId);

    if (!["owner", "admin"].includes(account.role)) {
      return NextResponse.json({ message: "Only owners and admins can add members." }, { status: 403 });
    }

    if (!email?.trim()) {
      return NextResponse.json({ message: "Missing email." }, { status: 400 });
    }

    if (role !== "admin" && role !== "member") {
      return NextResponse.json({ message: "Role must be admin or member." }, { status: 400 });
    }

    const admin = createAdminClient();
    const profileRes = await admin
      .from("profiles")
      .select("id, email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (profileRes.error) {
      throw profileRes.error;
    }

    if (!profileRes.data) {
      return NextResponse.json(
        {
          message: "Brukeren må logge inn én gang først, slik at profil opprettes."
        },
        { status: 404 }
      );
    }

    const supabase = await createClient();
    const insertRes = await supabase.from("account_members").upsert(
      {
        account_id: account.accountId,
        user_id: profileRes.data.id,
        role
      },
      {
        onConflict: "account_id,user_id"
      }
    );

    if (insertRes.error) {
      throw insertRes.error;
    }

    return NextResponse.json({ message: "Medlem lagt til." });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Could not add member."
      },
      { status: 500 }
    );
  }
}
