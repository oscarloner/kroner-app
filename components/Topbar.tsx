"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Workspace } from "@/lib/types";
import styles from "@/components/kroner.module.css";

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function buildHref(path: string, accountSlug: string, workspaceId?: string) {
  const params = new URLSearchParams({ account: accountSlug });
  if (workspaceId && workspaceId !== "all") {
    params.set("workspace", workspaceId);
  }
  return `${path}?${params.toString()}`;
}

export function Topbar({
  title,
  currentPath,
  accountSlug,
  currentAccountName,
  currentWorkspaceId,
  currentWorkspaceName,
  workspaces,
  searchValue,
  onSearchChange,
  actions
}: {
  title: string;
  currentPath: string;
  accountSlug: string;
  currentAccountName: string;
  currentWorkspaceId: string;
  currentWorkspaceName?: string;
  workspaces: Workspace[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const label = currentWorkspaceName || activeWorkspace?.name || currentAccountName;
  const dotColor = activeWorkspace?.color ?? "#888";

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarTitle}>{title}</div>
      <div className={styles.headerWorkspaceWrap} ref={wrapRef}>
        <button
          className={cx(styles.headerWorkspaceButton, open && styles.headerWorkspaceButtonOpen)}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className={styles.workspaceDot} style={{ backgroundColor: dotColor }} />
          <span className={styles.workspaceLabel}>{label}</span>
          <span className={styles.dropdownArrow}>▾</span>
        </button>
        <div className={cx(styles.headerWorkspaceMenu, open && styles.headerWorkspaceMenuOpen)}>
          <Link
            className={cx(styles.dropdownItem, currentWorkspaceId === "all" && styles.dropdownItemActive)}
            href={buildHref(currentPath, accountSlug)}
            onClick={() => setOpen(false)}
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
              href={buildHref(currentPath, accountSlug, workspace.id)}
              onClick={() => setOpen(false)}
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
  );
}
