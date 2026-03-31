import { AppShell } from "@/components/AppShell";
import { Charts } from "@/components/Charts";
import { getDashboardData } from "@/lib/data";

export default async function GraphPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);

  return (
    <AppShell
      currentPath="/graf"
      title="Graf"
      userEmail={data.userEmail}
      currentAccount={data.currentAccount}
      currentRole={data.currentRole}
      currentWorkspaceName={data.currentWorkspace?.name}
    >
      <Charts entries={data.entries} />
    </AppShell>
  );
}
