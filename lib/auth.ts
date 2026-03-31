import { cache } from "react";
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
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  assertAllowedUser(user.email ?? "");

  return user;
}

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
});

export function assertAllowedUser(email: string) {
  const allowedEmails = getAllowedEmails();
  const userEmail = email.toLowerCase();

  if (allowedEmails && !allowedEmails.has(userEmail)) {
    redirect("/login?error=unauthorized");
  }
}
