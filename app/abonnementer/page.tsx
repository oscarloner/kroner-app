import { AppShell } from "@/components/AppShell";
import { RecurringItemsClient } from "@/components/RecurringItemsClient";
import { getDashboardData } from "@/lib/data";

export default async function SubscriptionsPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);

  return (
    <AppShell currentPath="/abonnementer" currentAccount={data.currentAccount}>
      <RecurringItemsClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        currentAccountName={data.currentAccount.name}
        currentPath="/abonnementer"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        emptyLabel="Ingen abonnementer ennå."
        entries={data.entries}
        recurringItems={data.recurringItems}
        title="Abonnementer"
        type="sub"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
