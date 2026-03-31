import { getCurrentUser } from "@/lib/auth";
import type { AccountMember, AccountRole, AppAccount } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  account_id: string;
  user_id: string;
  role: AccountRole;
  created_at: string;
};

type AccountRow = {
  id: string;
  slug: string;
  name: string;
  created_by: string;
  created_at: string;
};

export async function getAccountContext(preferredSlug?: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const membershipsRes = await supabase
    .from("account_members")
    .select("account_id, user_id, role, created_at")
    .eq("user_id", user.id);

  if (membershipsRes.error) {
    throw new Error(membershipsRes.error.message);
  }

  const memberships = (membershipsRes.data ?? []) as MembershipRow[];
  if (memberships.length === 0) {
    throw new Error("User has no account memberships.");
  }

  const accountIds = memberships.map((membership) => membership.account_id);

  const accountsRes = await supabase
    .from("accounts")
    .select("id, slug, name, created_by, created_at")
    .in("id", accountIds)
    .order("created_at");

  if (accountsRes.error) {
    throw new Error(accountsRes.error.message);
  }

  const accounts: AppAccount[] = ((accountsRes.data ?? []) as AccountRow[]).map((account) => ({
      id: account.id,
      slug: account.slug,
      name: account.name,
      createdBy: account.created_by,
      createdAt: account.created_at
    }));

  const currentAccount =
    (preferredSlug ? accounts.find((account) => account.slug === preferredSlug) : undefined) ??
    accounts[0];

  if (!currentAccount) {
    throw new Error("No accessible account found.");
  }

  const currentMembership = memberships.find(
    (membership) => membership.account_id === currentAccount.id && membership.user_id === user.id
  );

  if (!currentMembership) {
    throw new Error("Missing membership for selected account.");
  }

  return {
    user,
    accounts,
    currentAccount,
    currentRole: currentMembership.role,
    members: [] as AccountMember[]
  };
}

export async function requireAccountAccess(accountId?: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  if (!accountId) {
    throw new Error("Missing accountId.");
  }

  const membershipRes = await supabase
    .from("account_members")
    .select("account_id, role")
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipRes.error) {
    throw new Error(membershipRes.error.message);
  }

  if (!membershipRes.data) {
    throw new Error("No access to selected account.");
  }

  return {
    user,
    role: membershipRes.data.role as AccountRole,
    accountId
  };
}
