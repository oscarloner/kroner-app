"use client";

import { useMemo, useState } from "react";
import type { Workspace } from "@/lib/types";

function buildHref(path: string, accountSlug: string, workspaceId: string) {
  const search = new URLSearchParams();
  search.set("account", accountSlug);
  search.set("workspace", workspaceId);
  return `${path}?${search.toString()}`;
}

export function WorkspaceSwitcher({
  accountId,
  accountSlug,
  currentPath,
  workspaces,
  currentWorkspaceId
}: {
  accountId: string;
  accountSlug: string;
  currentPath: string;
  workspaces: Workspace[];
  currentWorkspaceId: string;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0060b0");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const currentLabel = useMemo(() => {
    if (currentWorkspaceId === "all") {
      return "Alle workspaces";
    }

    return workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.name ?? "Workspace";
  }, [currentWorkspaceId, workspaces]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountId,
          name,
          color
        })
      });

      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke opprette workspace.");
      }

      setName("");
      setStatus(json.message || "Workspace opprettet.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke opprette workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panelTitle">Workspace</div>
      <div className="accountName">{currentLabel}</div>
      <div className="switchList">
        <a
          href={buildHref(currentPath, accountSlug, "all")}
          className={currentWorkspaceId === "all" ? "switchChip active" : "switchChip"}
        >
          Alle
        </a>
        {workspaces.map((workspace) => (
          <a
            key={workspace.id}
            href={buildHref(currentPath, accountSlug, workspace.id)}
            className={workspace.id === currentWorkspaceId ? "switchChip active" : "switchChip"}
          >
            {workspace.name}
          </a>
        ))}
      </div>

      <div className="sectionLabel">Ny workspace</div>
      <form className="loginForm" onSubmit={handleSubmit}>
        <input
          className="textInput"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Applaus Creative"
          required
        />
        <input
          className="textInput"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        <button className="primaryButton" type="submit" disabled={busy}>
          {busy ? "Oppretter..." : "Opprett workspace"}
        </button>
      </form>
      {status ? <div className="statusText">{status}</div> : null}
    </section>
  );
}
