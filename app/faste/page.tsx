import { AppShell } from "@/components/AppShell";
import { RecurringItemsClient } from "@/components/RecurringItemsClient";
import { getDashboardData } from "@/lib/data";

export default async function FixedIncomePage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);

  return (
    <AppShell currentPath="/faste" currentAccount={data.currentAccount}>
      <RecurringItemsClient
        accountId={data.currentAccount.id}
        accountSlug={data.currentAccount.slug}
        currentAccountName={data.currentAccount.name}
        currentPath="/faste"
        currentWorkspaceId={data.currentWorkspaceId}
        currentWorkspaceName={data.currentWorkspace?.name}
        emptyLabel="Ingen faste inntekter ennå."
        entries={data.entries}
        recurringItems={data.recurringItems}
        title="Faste inntekter"
        type="fixed"
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
