import type { AccountRole, AppAccount } from "@/lib/types";
import { formatMonthLabel } from "@/lib/format";

export function Header({
  title,
  userEmail,
  currentAccount,
  currentRole,
  currentWorkspaceName
}: {
  title: string;
  userEmail: string;
  currentAccount: AppAccount;
  currentRole: AccountRole;
  currentWorkspaceName?: string;
}) {
  return (
    <header className="header">
      <div>
        <div className="pageTitle">{title}</div>
        <div className="pageMeta">
          {formatMonthLabel()} · {userEmail} · {currentAccount.name} ·{" "}
          {currentWorkspaceName || "Alle workspaces"} · {currentRole}
        </div>
      </div>
      <div className="headerBadge">Notion-style PWA</div>
    </header>
  );
}
