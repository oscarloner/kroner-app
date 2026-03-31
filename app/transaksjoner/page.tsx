import { AppShell } from "@/components/AppShell";
import { TransactionsClient } from "@/components/TransactionsClient";
import { getDashboardData } from "@/lib/data";

export default async function TransactionsPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace, params?.month);

  return (
    <AppShell
      currentAccount={data.currentAccount}
      currentPath="/transaksjoner"
      currentWorkspaceId={data.currentWorkspaceId}
      selectedMonthKey={data.selectedMonthKey}
    >
      <TransactionsClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        accounts={data.accounts}
        currentAccountId={data.currentAccount.id}
        currentAccountName={data.currentAccount.name}
        currentPath="/transaksjoner"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        entries={data.entries}
        monthEntries={data.monthEntries}
        recurringItems={data.recurringItems}
        selectedMonthKey={data.selectedMonthKey}
        title="Transaksjoner"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
