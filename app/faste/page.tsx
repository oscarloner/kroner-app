import { AppShell } from "@/components/AppShell";
import { SubCard } from "@/components/SubCard";
import { getDashboardData } from "@/lib/data";

export default async function FixedIncomePage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);
  const workspaceMap = new Map(data.workspaces.map((workspace) => [workspace.id, workspace]));
  const items = data.recurringItems.filter((item) => item.type === "fixed");

  return (
    <AppShell
      currentPath="/faste"
      title="Faste inntekter"
      userEmail={data.userEmail}
      currentAccount={data.currentAccount}
      currentRole={data.currentRole}
      currentWorkspaceName={data.currentWorkspace?.name}
    >
      <section className="subGrid">
        {items.map((item) => (
          <SubCard
            key={item.id}
            item={item}
            workspace={item.workspaceId ? workspaceMap.get(item.workspaceId) : undefined}
            deletable
          />
        ))}
        {items.length === 0 ? (
          <section className="panel">
            <div className="emptyState">Ingen faste inntekter ennå.</div>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
