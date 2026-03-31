"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatMonthLabel } from "@/lib/format";
import { buildAppHref } from "@/lib/navigation";
import { getMonthOptions, shiftMonthKey } from "@/lib/month";
import type { AppAccount, Workspace } from "@/lib/types";
import styles from "@/components/kroner.module.css";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Topbar({
  title,
  currentPath,
  accountSlug,
  accounts,
  currentAccountId,
  currentAccountName,
  currentWorkspaceId,
  currentWorkspaceName,
  workspaces,
  monthKey,
  searchValue,
  onSearchChange,
  actions
}: {
  title: string;
  currentPath: string;
  accountSlug: string;
  accounts: AppAccount[];
  currentAccountId: string;
  currentAccountName: string;
  currentWorkspaceId: string;
  currentWorkspaceName?: string;
  workspaces: Workspace[];
  monthKey: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions?: React.ReactNode;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const workspaceLabel =
    currentWorkspaceId === "all"
      ? "Alle kontoer"
      : currentWorkspaceName || activeWorkspace?.name || currentAccountName;
  const workspaceDotColor = activeWorkspace?.color ?? "#888";
  const previousMonth = shiftMonthKey(monthKey, -1);
  const nextMonth = shiftMonthKey(monthKey, 1);
  const monthOptions = getMonthOptions(monthKey, 6);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setWorkspaceOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!sheetOpen) {
      return undefined;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSheetOpen(false);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sheetOpen]);

  return (
    <>
      <header className={cx(styles.topbar, styles.topbarDesktop)}>
        <div className={styles.topbarTitle}>{title}</div>
        <div className={styles.headerWorkspaceWrap} ref={wrapRef}>
          <button
            className={cx(styles.headerWorkspaceButton, workspaceOpen && styles.headerWorkspaceButtonOpen)}
            onClick={() => setWorkspaceOpen((value) => !value)}
            type="button"
          >
            <span className={styles.workspaceDot} style={{ backgroundColor: workspaceDotColor }} />
            <span className={styles.workspaceLabel}>{workspaceLabel}</span>
            <span className={styles.dropdownArrow}>▾</span>
          </button>
          <div className={cx(styles.headerWorkspaceMenu, workspaceOpen && styles.headerWorkspaceMenuOpen)}>
            <Link
              className={cx(styles.dropdownItem, currentWorkspaceId === "all" && styles.dropdownItemActive)}
              href={buildAppHref(currentPath, { accountSlug, monthKey }) as never}
              onClick={() => setWorkspaceOpen(false)}
              prefetch
            >
              <span className={styles.workspaceDot} style={{ backgroundColor: "#888" }} />
              Alle kontoer
            </Link>
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                className={cx(
                  styles.dropdownItem,
                  workspace.id === currentWorkspaceId && styles.dropdownItemActive
                )}
                href={
                  buildAppHref(currentPath, {
                    accountSlug,
                    monthKey,
                    workspaceId: workspace.id
                  }) as never
                }
                onClick={() => setWorkspaceOpen(false)}
                prefetch
              >
                <span className={styles.workspaceDot} style={{ backgroundColor: workspace.color }} />
                {workspace.name}
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.spacer} />
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Søk..."
            value={searchValue}
          />
        </div>
        {actions}
      </header>

      <header className={cx(styles.topbar, styles.topbarMobile)}>
        <div className={styles.topbarHeaderRow}>
          <div className={styles.topbarHeading}>
            <div className={styles.topbarEyebrow}>{currentAccountName}</div>
            <div className={styles.topbarTitle}>{title}</div>
          </div>

          <button className={styles.topbarSheetButton} onClick={() => setSheetOpen(true)} type="button">
            Filtre
          </button>
        </div>

        <div className={styles.topbarUtilityRow}>
          <div className={styles.topbarMonthControl}>
            <Link
              className={styles.monthButton}
              href={
                buildAppHref(currentPath, {
                  accountSlug,
                  monthKey: previousMonth,
                  workspaceId: currentWorkspaceId
                }) as never
              }
              prefetch
            >
              ‹
            </Link>
            <div className={styles.topbarMonthLabel}>{formatMonthLabel(monthKey)}</div>
            <Link
              className={styles.monthButton}
              href={
                buildAppHref(currentPath, {
                  accountSlug,
                  monthKey: nextMonth,
                  workspaceId: currentWorkspaceId
                }) as never
              }
              prefetch
            >
              ›
            </Link>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>⌕</span>
            <input
              className={styles.searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Søk..."
              value={searchValue}
            />
          </div>

          <div className={styles.topbarActionsSlot}>{actions}</div>
        </div>
      </header>

      {sheetOpen ? (
        <div
          className={cx(styles.overlay, styles.overlayOpen, styles.mobileSheetOverlay)}
          onClick={() => setSheetOpen(false)}
          role="presentation"
        >
          <div
            className={cx(styles.modal, styles.mobileSheet)}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.modalTitle}>Filtre og navigasjon</div>

            <div className={styles.sheetSection}>
              <div className={styles.sheetSectionLabel}>Konto</div>
              <div className={styles.sheetChipList}>
                {accounts.map((account) => (
                  <Link
                    key={account.id}
                    className={cx(styles.sheetChip, account.id === currentAccountId && styles.sheetChipActive)}
                    href={buildAppHref(currentPath, { accountSlug: account.slug, monthKey }) as never}
                    onClick={() => setSheetOpen(false)}
                    prefetch
                  >
                    {account.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.sheetSection}>
              <div className={styles.sheetSectionLabel}>Workspace</div>
              <div className={styles.sheetChipList}>
                <Link
                  className={cx(styles.sheetChip, currentWorkspaceId === "all" && styles.sheetChipActive)}
                  href={buildAppHref(currentPath, { accountSlug, monthKey }) as never}
                  onClick={() => setSheetOpen(false)}
                  prefetch
                >
                  Alle kontoer
                </Link>
                {workspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    className={cx(
                      styles.sheetChip,
                      workspace.id === currentWorkspaceId && styles.sheetChipActive
                    )}
                    href={
                      buildAppHref(currentPath, {
                        accountSlug,
                        monthKey,
                        workspaceId: workspace.id
                      }) as never
                    }
                    onClick={() => setSheetOpen(false)}
                    prefetch
                  >
                    {workspace.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.sheetSection}>
              <div className={styles.sheetSectionLabel}>Måned</div>
              <div className={styles.sheetChipList}>
                {monthOptions.map((option) => (
                  <Link
                    key={option.key}
                    className={cx(styles.sheetChip, option.key === monthKey && styles.sheetChipActive)}
                    href={
                      buildAppHref(currentPath, {
                        accountSlug,
                        monthKey: option.key,
                        workspaceId: currentWorkspaceId
                      }) as never
                    }
                    onClick={() => setSheetOpen(false)}
                    prefetch
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalPrimary} onClick={() => setSheetOpen(false)} type="button">
                Lukk
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
