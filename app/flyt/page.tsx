import { AppShell } from "@/components/AppShell";
import { FlytPageClient } from "@/components/FlytPageClient";
import { getDashboardData } from "@/lib/data";

export default async function FlytPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string; month?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace, params?.month);

  return (
    <AppShell
      currentAccount={data.currentAccount}
      currentPath="/flyt"
      currentWorkspaceId={data.currentWorkspaceId}
      selectedMonthKey={data.selectedMonthKey}
    >
      <FlytPageClient accountSlug={data.currentAccount.slug} />
    </AppShell>
  );
}
