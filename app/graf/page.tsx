import { AppShell } from "@/components/AppShell";
import { GraphPageClient } from "@/components/GraphPageClient";
import { getDashboardData } from "@/lib/data";

export default async function GraphPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);

  return (
    <AppShell currentPath="/graf" currentAccount={data.currentAccount}>
      <GraphPageClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        currentAccountName={data.currentAccount.name}
        currentPath="/graf"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        entries={data.entries}
        recurringItems={data.recurringItems}
        title="Graf"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
