"use client";

import { useState } from "react";

export function LocalImportCard({ accountId }: { accountId: string }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function importLegacyData() {
    setBusy(true);
    setStatus("");

    try {
      const payload = {
        accountId,
        entries: JSON.parse(window.localStorage.getItem("oko5_entries") || "[]"),
        workspaces: JSON.parse(window.localStorage.getItem("oko5_ws") || "[]"),
        subs: JSON.parse(window.localStorage.getItem("oko5_subs") || "[]")
      };

      const response = await fetch("/api/import-local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message || "Import feilet.");
      }

      setStatus(json.message || "Import fullført.");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import feilet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panelTitle">Importer gammel localStorage-data</div>
      <p className="mutedText">
        Denne knappen leser <code>oko5_entries</code>, <code>oko5_ws</code> og{" "}
        <code>oko5_subs</code> fra nettleseren og flytter dem inn i valgt delt konto.
      </p>
      <button className="primaryButton" onClick={importLegacyData} disabled={busy}>
        {busy ? "Importerer..." : "Importer fra gammel app"}
      </button>
      {status ? <div className="statusText">{status}</div> : null}
    </section>
  );
}
