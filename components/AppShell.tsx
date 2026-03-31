import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import styles from "@/components/kroner.module.css";
import { buildAppHref } from "@/lib/navigation";
import type { AppAccount } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "Oversikt", icon: "◈" },
  { href: "/transaksjoner", label: "Transaksjoner", icon: "↕" },
  { href: "/faste", label: "Faste utgifter", icon: "★" },
  { href: "/graf", label: "Graf", icon: "↗" }
] as const;

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AppShell({
  children,
  currentPath,
  currentAccount,
  currentWorkspaceId,
  selectedMonthKey
}: {
  children: React.ReactNode;
  currentPath: string;
  currentAccount: AppAccount;
  currentWorkspaceId: string;
  selectedMonthKey: string;
}) {
  return (
    <div className={styles.shell}>
      <Sidebar
        currentAccountSlug={currentAccount.slug}
        currentPath={currentPath}
        currentWorkspaceId={currentWorkspaceId}
        selectedMonthKey={selectedMonthKey}
      />
      <main className={styles.main}>
        {children}
        <nav className={styles.mobileBottomNav} aria-label="Primær navigasjon">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                className={cx(styles.mobileBottomLink, active && styles.mobileBottomLinkActive)}
                href={
                  buildAppHref(item.href, {
                    accountSlug: currentAccount.slug,
                    monthKey: selectedMonthKey,
                    workspaceId: currentWorkspaceId
                  }) as never
                }
              >
                <span className={styles.mobileBottomIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
