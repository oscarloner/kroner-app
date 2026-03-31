"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const supabase = createClient();
      const redirectTo =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo
        }
      });

      if (error) {
        throw error;
      }

      setStatus("Innloggingslenke sendt.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke starte innlogging.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="loginShell">
      <div className="loginCard">
        <div className="pageTitle">Kroner</div>
        <p className="mutedText">
          Innlogging er flyttet til Supabase Auth. Bruk <code>ALLOWED_EMAILS</code> hvis dere vil
          begrense appen til et fast sett med brukere.
        </p>
        <form className="loginForm" onSubmit={handleLogin}>
          <input
            className="textInput"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="oscar@..."
            required
          />
          <button className="primaryButton" type="submit" disabled={busy}>
            {busy ? "Sender..." : "Send magic link"}
          </button>
        </form>
        {status ? <div className="statusText">{status}</div> : null}
      </div>
    </div>
  );
}
