import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getAllowedEmails() {
  const fromList = process.env.ALLOWED_EMAILS
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const single = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

  if (fromList && fromList.length > 0) {
    return new Set(fromList);
  }

  return single ? new Set([single]) : null;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowedEmails = getAllowedEmails();
  const userEmail = user.email?.toLowerCase() ?? "";

  if (allowedEmails && !allowedEmails.has(userEmail)) {
    redirect("/login?error=unauthorized");
  }

  return user;
}
