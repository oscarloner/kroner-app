import { AppShell } from "@/components/AppShell";
import { TransactionsClient } from "@/components/TransactionsClient";
import { getDashboardData } from "@/lib/data";

export default async function TransactionsPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);

  return (
    <AppShell currentPath="/transaksjoner" currentAccount={data.currentAccount}>
      <TransactionsClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        currentAccountName={data.currentAccount.name}
        currentPath="/transaksjoner"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        entries={data.entries}
        recurringItems={data.recurringItems}
        title="Transaksjoner"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
