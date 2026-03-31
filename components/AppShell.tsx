import type { AccountRole, AppAccount } from "@/lib/types";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({
  children,
  currentPath,
  title,
  userEmail,
  currentAccount,
  currentRole,
  currentWorkspaceName
}: {
  children: React.ReactNode;
  currentPath: string;
  title: string;
  userEmail: string;
  currentAccount: AppAccount;
  currentRole: AccountRole;
  currentWorkspaceName?: string;
}) {
  return (
    <div className="appShell">
      <Sidebar currentPath={currentPath} currentAccountSlug={currentAccount.slug} />
      <main className="mainContent">
        <Header
          title={title}
          userEmail={userEmail}
          currentAccount={currentAccount}
          currentRole={currentRole}
          currentWorkspaceName={currentWorkspaceName}
        />
        {children}
      </main>
    </div>
  );
}
