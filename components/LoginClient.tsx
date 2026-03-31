"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import styles from "@/app/login/login.module.css";

type LoginClientProps = {
  initialError?: string;
  nextPath: string;
};

export function LoginClient({ initialError, nextPath }: LoginClientProps) {
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
      <div className={styles.frame}>
        <section className={styles.hero}>
          <div className={styles.brand}>Kr</div>
          <h1 className={styles.heroTitle}>Kroner</h1>
          <p className={styles.heroText}>
            Delte kontoer, faste kostnader og transaksjoner samlet i ett ryddig arbeidsrom.
          </p>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} />
              Felles oversikt over kontoer og medlemskap
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} />
              Supabase Auth med vanlig e-post og passord
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} />
              Tilgang kan begrenses med <code>ALLOWED_EMAILS</code>
            </li>
          </ul>
        </section>

        <section className={styles.card}>
          <p className={styles.eyebrow}>Logg inn</p>
          <h2 className={styles.title}>Velkommen tilbake</h2>
          <p className={styles.description}>
            Bruk e-postadressen og passordet ditt for å åpne arbeidsområdet.
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
            Kontoene styres via Supabase Auth. Hvis dere vil begrense appen til bestemte brukere,
            bruk <code>ALLOWED_EMAILS</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
