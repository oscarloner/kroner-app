import type { AccountMember, AccountRole, AppAccount } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type AccountRow = {
  id: string;
  slug: string;
  name: string;
  created_by: string;
  created_at: string;
};

type MembershipRow = {
  account_id: string;
  user_id: string;
  role: AccountRole;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

export async function getAccountContext(preferredSlug?: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

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
  const accountIds = memberships.map((membership) => membership.account_id);

  if (accountIds.length === 0) {
    throw new Error("User has no account memberships.");
  }

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

  const membersRes = await supabase
    .from("account_members")
    .select("account_id, user_id, role, created_at")
    .eq("account_id", currentAccount.id)
    .order("created_at");

  if (membersRes.error) {
    throw new Error(membersRes.error.message);
  }

  const memberRows = (membersRes.data ?? []) as MembershipRow[];
  const userIds = memberRows.map((member) => member.user_id);

  const profilesRes = await supabase.from("profiles").select("id, email, full_name").in("id", userIds);

  if (profilesRes.error) {
    throw new Error(profilesRes.error.message);
  }

  const profiles = new Map(
    ((profilesRes.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const members: AccountMember[] = memberRows.map((member) => {
    const profile = profiles.get(member.user_id);

    return {
      accountId: member.account_id,
      userId: member.user_id,
      email: profile?.email ?? "",
      fullName: profile?.full_name ?? null,
      role: member.role,
      createdAt: member.created_at
    };
  });

  return {
    user,
    accounts,
    currentAccount,
    currentRole: currentMembership.role,
    members
  };
}

export async function requireAccountAccess(accountId?: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

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
