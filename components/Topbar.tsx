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
  accountId,
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
  accountId: string;
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
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceColor, setWorkspaceColor] = useState("#787774");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const workspaceLabel =
    currentWorkspaceId === "all"
      ? "Alle prosjekter"
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

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceName.trim() || workspaceBusy) {
      return;
    }

    setWorkspaceBusy(true);
    setWorkspaceStatus("");

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountId,
          name: workspaceName,
          color: workspaceColor
        })
      });

      const json = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke opprette prosjekt.");
      }

      setWorkspaceName("");
      setWorkspaceStatus("");
      window.location.reload();
    } catch (error) {
      setWorkspaceStatus(error instanceof Error ? error.message : "Kunne ikke opprette prosjekt.");
    } finally {
      setWorkspaceBusy(false);
    }
  }

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

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "p") {
        return;
      }

      event.preventDefault();

      const refs = [desktopSearchRef.current, mobileSearchRef.current];
      const visibleInput =
        refs.find((input) => input && input.offsetParent !== null) ?? desktopSearchRef.current ?? mobileSearchRef.current;

      visibleInput?.focus();
      visibleInput?.select();
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

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
              prefetch={false}
            >
              <span className={styles.workspaceDot} style={{ backgroundColor: "#888" }} />
              Alle prosjekter
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
                prefetch={false}
              >
                <span className={styles.workspaceDot} style={{ backgroundColor: workspace.color }} />
                {workspace.name}
              </Link>
            ))}
            <button
              className={styles.dropdownAction}
              onClick={() => {
                setCreateWorkspaceOpen((value) => !value);
                setWorkspaceStatus("");
              }}
              type="button"
            >
              + Nytt prosjekt
            </button>
            {createWorkspaceOpen ? (
              <form className={styles.workspaceCreateForm} onSubmit={handleCreateWorkspace}>
                <input
                  className={styles.input}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Privat"
                  value={workspaceName}
                />
                <div className={styles.workspaceCreateRow}>
                  <input
                    aria-label="Prosjektfarge"
                    className={styles.workspaceColorInput}
                    onChange={(event) => setWorkspaceColor(event.target.value)}
                    type="color"
                    value={workspaceColor}
                  />
                  <button className={styles.smallButton} disabled={workspaceBusy} type="submit">
                    {workspaceBusy ? "Oppretter..." : "Opprett"}
                  </button>
                </div>
                {workspaceStatus ? <div className={styles.statusText}>{workspaceStatus}</div> : null}
              </form>
            ) : null}
          </div>
        </div>
        <div className={styles.spacer} />
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Søk..."
            ref={desktopSearchRef}
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
              prefetch={false}
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
              prefetch={false}
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
              ref={mobileSearchRef}
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
                    prefetch={false}
                  >
                    {account.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.sheetSection}>
            <div className={styles.sheetSectionLabel}>Prosjekt</div>
            <div className={styles.sheetChipList}>
                <Link
                  className={cx(styles.sheetChip, currentWorkspaceId === "all" && styles.sheetChipActive)}
                  href={buildAppHref(currentPath, { accountSlug, monthKey }) as never}
                  onClick={() => setSheetOpen(false)}
                  prefetch={false}
                >
                  Alle prosjekter
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
                    prefetch={false}
                  >
                    {workspace.name}
                  </Link>
                ))}
              </div>
              <button
                className={styles.smallButton}
                onClick={() => {
                  setCreateWorkspaceOpen((value) => !value);
                  setWorkspaceStatus("");
                }}
                type="button"
              >
                + Nytt prosjekt
              </button>
              {createWorkspaceOpen ? (
                <form className={styles.workspaceCreateForm} onSubmit={handleCreateWorkspace}>
                  <input
                    className={styles.input}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Privat"
                    value={workspaceName}
                  />
                  <div className={styles.workspaceCreateRow}>
                    <input
                      aria-label="Prosjektfarge"
                      className={styles.workspaceColorInput}
                      onChange={(event) => setWorkspaceColor(event.target.value)}
                      type="color"
                      value={workspaceColor}
                    />
                    <button className={styles.smallButton} disabled={workspaceBusy} type="submit">
                      {workspaceBusy ? "Oppretter..." : "Opprett"}
                    </button>
                  </div>
                  {workspaceStatus ? <div className={styles.statusText}>{workspaceStatus}</div> : null}
                </form>
              ) : null}
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
                    prefetch={false}
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
