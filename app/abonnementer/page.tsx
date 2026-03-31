import { AppShell } from "@/components/AppShell";
import { RecurringItemsClient } from "@/components/RecurringItemsClient";
import { getDashboardData } from "@/lib/data";

export default async function SubscriptionsPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace, params?.month);

  return (
    <AppShell
      currentAccount={data.currentAccount}
      currentPath="/abonnementer"
      currentWorkspaceId={data.currentWorkspaceId}
      selectedMonthKey={data.selectedMonthKey}
    >
      <RecurringItemsClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        accounts={data.accounts}
        currentAccountId={data.currentAccount.id}
        currentAccountName={data.currentAccount.name}
        currentPath="/abonnementer"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        emptyLabel="Ingen abonnementer ennå."
        entries={data.entries}
        recurringItems={data.recurringItems}
        selectedMonthKey={data.selectedMonthKey}
        title="Abonnementer"
        type="sub"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
