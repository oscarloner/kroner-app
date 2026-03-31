import type { AppAccount } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import styles from "@/components/kroner.module.css";

export function AppShell({
  children,
  currentPath,
  currentAccount,
}: {
  children: React.ReactNode;
  currentPath: string;
  currentAccount: AppAccount;
}) {
  return (
    <div className={styles.shell}>
      <Sidebar currentPath={currentPath} currentAccountSlug={currentAccount.slug} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
