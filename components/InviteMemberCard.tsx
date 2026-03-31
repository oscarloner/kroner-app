"use client";

import { useState } from "react";
import type { AccountRole } from "@/lib/types";

export function InviteMemberCard({ accountId }: { accountId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("member");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/account-members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountId,
          email,
          role
        })
      });

      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(json.message || "Kunne ikke legge til medlem.");
      }

      setStatus(json.message || "Medlem lagt til.");
      setEmail("");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke legge til medlem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panelTitle">Legg til medlem</div>
      <p className="mutedText">
        Personen må ha logget inn minst én gang først. Deretter kan du gi tilgang til denne kontoen.
      </p>
      <form className="loginForm" onSubmit={handleSubmit}>
        <input
          className="textInput"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="venn@..."
          required
        />
        <select
          className="textInput"
          value={role}
          onChange={(event) => setRole(event.target.value as AccountRole)}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="primaryButton" type="submit" disabled={busy}>
          {busy ? "Legger til..." : "Legg til medlem"}
        </button>
      </form>
      {status ? <div className="statusText">{status}</div> : null}
    </section>
  );
}
