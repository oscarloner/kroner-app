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
    <AppShell
      currentPath="/transaksjoner"
      title="Transaksjoner"
      userEmail={data.userEmail}
      currentAccount={data.currentAccount}
      currentRole={data.currentRole}
      currentWorkspaceName={data.currentWorkspace?.name}
    >
      <TransactionsClient entries={data.entries} workspaces={data.workspaces} />
    </AppShell>
  );
}
