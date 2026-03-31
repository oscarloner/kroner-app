import { AppShell } from "@/components/AppShell";
import { OverviewClient } from "@/components/OverviewClient";
import { getDashboardData } from "@/lib/data";

export default async function OverviewPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);

  return (
    <AppShell currentPath="/" currentAccount={data.currentAccount}>
      <OverviewClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        currentAccountName={data.currentAccount.name}
        currentPath="/"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        entries={data.entries}
        recurringItems={data.recurringItems}
        title="Oversikt"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
