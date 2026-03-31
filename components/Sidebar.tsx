"use client";

import Link from "next/link";
import { useState } from "react";
import type { UrlObject } from "url";
import { formatMonthLabel } from "@/lib/format";
import styles from "@/components/kroner.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Oversikt", icon: "◈" },
  { href: "/transaksjoner", label: "Transaksjoner", icon: "↕" },
  { href: "/faste", label: "Faste inntekter", icon: "★" },
  { href: "/abonnementer", label: "Abonnementer", icon: "↻" },
  { href: "/graf", label: "Graf", icon: "↗" }
] as const;

function withAccount(path: string, accountSlug?: string): UrlObject {
  return {
    pathname: path,
    ...(accountSlug
      ? {
          query: {
            account: accountSlug
          }
        }
      : {})
  };
}

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function shiftMonth(date: Date, direction: -1 | 1) {
  return new Date(date.getFullYear(), date.getMonth() + direction, 1);
}

export function Sidebar({
  currentPath,
  currentAccountSlug
}: {
  currentPath: string;
  currentAccountSlug?: string;
}) {
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <div className={styles.brand}>Kroner</div>
        <div className={styles.brandSub}>{formatMonthLabel(monthCursor)}</div>
      </div>

      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionLabel}>Sider</div>
        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                className={cx(styles.dropdownItem, active && styles.dropdownItemActive)}
                href={withAccount(item.href, currentAccountSlug)}
                prefetch
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
          <button
            className={styles.monthButton}
            onClick={() => setMonthCursor((value) => shiftMonth(value, -1))}
            type="button"
          >
            ‹
          </button>
          <span className={styles.monthLabel}>{formatMonthLabel(monthCursor)}</span>
          <button
            className={styles.monthButton}
            onClick={() => setMonthCursor((value) => shiftMonth(value, 1))}
            type="button"
          >
            ›
          </button>
        </div>
      </div>
    </aside>
  );
}
