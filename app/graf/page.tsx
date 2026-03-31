import { AppShell } from "@/components/AppShell";
import { GraphPageClient } from "@/components/GraphPageClient";
import { getDashboardData } from "@/lib/data";

export default async function GraphPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace, params?.month, {
    includeHistoricalEntries: true
  });

  return (
    <AppShell
      currentAccount={data.currentAccount}
      currentPath="/graf"
      currentWorkspaceId={data.currentWorkspaceId}
      selectedMonthKey={data.selectedMonthKey}
    >
      <GraphPageClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        accounts={data.accounts}
        currentAccountId={data.currentAccount.id}
        currentAccountName={data.currentAccount.name}
        currentPath="/graf"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        entries={data.entries}
        recurringItems={data.recurringItems}
        selectedMonthKey={data.selectedMonthKey}
        title="Graf"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
