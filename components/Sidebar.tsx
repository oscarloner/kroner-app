"use client";

import Link from "next/link";
import { formatMonthLabel } from "@/lib/format";
import { buildAppHref } from "@/lib/navigation";
import { shiftMonthKey } from "@/lib/month";
import styles from "@/components/kroner.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Oversikt", icon: "◈" },
  { href: "/transaksjoner", label: "Transaksjoner", icon: "↕" },
  { href: "/faste", label: "Faste inntekter", icon: "★" },
  { href: "/faste-utgifter", label: "Faste utgifter", icon: "↻" }
] as const;

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isActivePath(currentPath: string, itemHref: string) {
  if (itemHref === "/") {
    return currentPath === "/";
  }

  return currentPath === itemHref;
}

export function Sidebar({
  currentPath,
  currentAccountSlug,
  currentWorkspaceId,
  selectedMonthKey
}: {
  currentPath: string;
  currentAccountSlug?: string;
  currentWorkspaceId: string;
  selectedMonthKey: string;
}) {
  const previousMonth = shiftMonthKey(selectedMonthKey, -1);
  const nextMonth = shiftMonthKey(selectedMonthKey, 1);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <div className={styles.brand}>Kroner</div>
        <div className={styles.brandSub}>{formatMonthLabel(selectedMonthKey)}</div>
      </div>

      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionLabel}>Sider</div>
        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(currentPath, item.href);

            return (
              <Link
                key={item.href}
                className={cx(styles.dropdownItem, active && styles.dropdownItemActive)}
                href={
                  buildAppHref(item.href, {
                    accountSlug: currentAccountSlug,
                    monthKey: selectedMonthKey,
                    workspaceId: currentWorkspaceId
                  }) as never
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.monthNav}>
          <Link
            className={styles.monthButton}
            href={
              buildAppHref(currentPath, {
                accountSlug: currentAccountSlug,
                monthKey: previousMonth,
                workspaceId: currentWorkspaceId
              }) as never
            }
            prefetch={false}
          >
            ‹
          </Link>
          <span className={styles.monthLabel}>{formatMonthLabel(selectedMonthKey)}</span>
          <Link
            className={styles.monthButton}
            href={
              buildAppHref(currentPath, {
                accountSlug: currentAccountSlug,
                monthKey: nextMonth,
                workspaceId: currentWorkspaceId
              }) as never
            }
            prefetch={false}
          >
            ›
          </Link>
        </div>
      </div>
    </aside>
  );
}
