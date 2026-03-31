import { AccountPanel } from "@/components/AccountPanel";
import { AppShell } from "@/components/AppShell";
import { AddModal } from "@/components/AddModal";
import { LocalImportCard } from "@/components/LocalImportCard";
import { OverviewClient } from "@/components/OverviewClient";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { getDashboardData } from "@/lib/data";

export default async function OverviewPage({
  searchParams
}: {
  searchParams?: Promise<{ account?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params?.account, params?.workspace);

  return (
    <AppShell
      currentPath="/"
      title="Oversikt"
      userEmail={data.userEmail}
      currentAccount={data.currentAccount}
      currentRole={data.currentRole}
      currentWorkspaceName={data.currentWorkspace?.name}
    >
      <section className="panelGrid">
        <WorkspaceSwitcher
          accountId={data.currentAccount.id}
          accountSlug={data.currentAccount.slug}
          currentPath="/"
          workspaces={data.workspaces}
          currentWorkspaceId={data.currentWorkspaceId}
        />
        <LocalImportCard accountId={data.currentAccount.id} />
        <AccountPanel
          accounts={data.accounts}
          currentAccount={data.currentAccount}
          entries={data.entries}
          recurringItems={data.recurringItems}
        />
        <AddModal
          accountId={data.currentAccount.id}
          workspaces={data.workspaces}
          currentWorkspaceId={data.currentWorkspaceId}
        />
      </section>
      <OverviewClient
        entries={data.entries}
        recurringItems={data.recurringItems}
        workspaces={data.workspaces}
      />
    </AppShell>
  );
}
