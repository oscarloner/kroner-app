import { AppShell } from "@/components/AppShell";
import { KnownRulesClient } from "@/components/KnownRulesClient";
import { fetchKnownBankRules } from "@/lib/bank-import-server";
import { getDashboardData } from "@/lib/data";

export default async function RulesPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace, params?.month);
  const rules = await fetchKnownBankRules(data.currentAccount.id);

  return (
    <AppShell
      currentAccount={data.currentAccount}
      currentPath="/regler"
      currentWorkspaceId={data.currentWorkspaceId}
      selectedMonthKey={data.selectedMonthKey}
    >
      <KnownRulesClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        accounts={data.accounts}
        currentAccountId={data.currentAccount.id}
        currentAccountName={data.currentAccount.name}
        currentPath="/regler"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        initialRules={rules}
        selectedMonthKey={data.selectedMonthKey}
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
