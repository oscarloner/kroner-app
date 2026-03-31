import { AppShell } from "@/components/AppShell";
import { RecurringItemsClient } from "@/components/RecurringItemsClient";
import { getDashboardData } from "@/lib/data";

export default async function FixedExpensesPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace, params?.month);

  return (
    <AppShell
      currentAccount={data.currentAccount}
      currentPath="/faste-utgifter"
      currentWorkspaceId={data.currentWorkspaceId}
      selectedMonthKey={data.selectedMonthKey}
    >
      <RecurringItemsClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        accounts={data.accounts}
        currentAccountId={data.currentAccount.id}
        currentAccountName={data.currentAccount.name}
        currentPath="/faste-utgifter"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        emptyLabel="Ingen faste utgifter ennå."
        entries={data.entries}
        recurringItems={data.recurringItems}
        selectedMonthKey={data.selectedMonthKey}
        title="Faste utgifter"
        recurringType="sub"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
