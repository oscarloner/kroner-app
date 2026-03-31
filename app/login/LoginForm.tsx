"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import styles from "@/app/login/login.module.css";

type LoginFormProps = {
  initialError?: string;
  nextPath: string;
};

export function LoginForm({ initialError, nextPath }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    setStatusError(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      window.location.assign(nextPath);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke logge inn.");
      setStatusError(true);
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!email) {
      setStatus("Skriv inn e-postadressen din først.");
      setStatusError(true);
      return;
    }

    setResetBusy(true);
    setStatus("");
    setStatusError(false);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) {
        throw error;
      }

      setStatus("Tilbakestillingslenke sendt. Sjekk e-posten din.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke sende tilbakestilling.");
      setStatusError(true);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.brandBlock}>
          <div className={styles.brand}>Kroner</div>
          <div className={styles.brandSub}>PERSONLIG OKONOMI</div>
        </div>

        <p className={styles.cardLabel}>Innlogging</p>
        <h1 className={styles.cardTitle}>Velkommen tilbake</h1>
        <p className={styles.cardText}>
          Logg inn med e-post og passord for a apne arbeidsomradet ditt.
        </p>

        <div className={styles.infoList}>
          <div className={styles.infoRow}>Delte kontoer og medlemskap</div>
          <div className={styles.infoRow}>Passordbasert innlogging via Supabase</div>
          <div className={styles.infoRow}>
            Tilgang kan begrenses med <code>ALLOWED_EMAILS</code>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleLogin}>
          <label className={styles.field}>
            <span className={styles.label}>E-post</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="oscar@..."
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Passord</span>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passord"
              autoComplete="current-password"
              required
            />
          </label>

          <div className={styles.row}>
            <button
              className={styles.linkButton}
              onClick={handlePasswordReset}
              type="button"
              disabled={busy || resetBusy}
            >
              {resetBusy ? "Sender..." : "Glemt passord?"}
            </button>
          </div>

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Logger inn..." : "Logg inn"}
          </button>
        </form>

        {initialError && !status ? (
          <div className={`${styles.status} ${styles.statusError}`}>{initialError}</div>
        ) : null}
        {status ? (
          <div className={`${styles.status} ${statusError ? styles.statusError : ""}`}>
            {status}
          </div>
        ) : null}

        <p className={styles.footnote}>
          Hvis brukeren ikke har passord ennå, ma det settes i Supabase først.
        </p>
      </section>
    </div>
  );
}
