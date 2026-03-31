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

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brand}>Kroner</div>
          <div className={styles.brandSub}>PERSONLIG OKONOMI</div>
        </div>
        <div className={styles.sidebarBody}>
          <div className={styles.sidebarLabel}>Status</div>
          <h1 className={styles.sidebarTitle}>Logg inn for a fortsette.</h1>
          <p className={styles.sidebarText}>
            Samme system som resten av appen: rolige flater, enkle valg og ingen stoy.
          </p>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>Delte kontoer og medlemskap</div>
            <div className={styles.infoRow}>Passordbasert innlogging via Supabase</div>
            <div className={styles.infoRow}>
              Tilgang kan begrenses med <code>ALLOWED_EMAILS</code>
            </div>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarTitle}>Innlogging</div>
        </div>

        <div className={styles.content}>
          <section className={styles.card}>
            <p className={styles.cardLabel}>Supabase Auth</p>
            <h2 className={styles.cardTitle}>Velkommen tilbake</h2>
            <p className={styles.cardText}>
              Bruk e-postadressen og passordet ditt for a apne arbeidsomradet.
            </p>

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
              Hvis brukeren ikke har passord ennå, må det settes i Supabase først.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
