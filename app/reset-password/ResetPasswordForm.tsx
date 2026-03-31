"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import styles from "@/app/login/login.module.css";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setStatusError(false);

    if (password.length < 6) {
      setStatus("Passordet ma vaere minst 6 tegn.");
      setStatusError(true);
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passordene matcher ikke.");
      setStatusError(true);
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setStatus("Passord oppdatert. Du kan ga tilbake og logge inn.");
      setConfirmPassword("");
      setPassword("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Kunne ikke oppdatere passord.");
      setStatusError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.brandBlock}>
          <div className={styles.brand}>Kroner</div>
          <div className={styles.brandSub}>PERSONLIG OKONOMI</div>
        </div>

        <p className={styles.cardLabel}>Passord</p>
        <h1 className={styles.cardTitle}>Sett nytt passord</h1>
        <p className={styles.cardText}>
          {ready
            ? "Velg et nytt passord for brukeren din."
            : "Apne lenken fra e-posten for a aktivere tilbakestillingen."}
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Nytt passord</span>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nytt passord"
              autoComplete="new-password"
              disabled={!ready}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Gjenta passord</span>
            <input
              className={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Gjenta passord"
              autoComplete="new-password"
              disabled={!ready}
              required
            />
          </label>

          <button className={styles.submit} type="submit" disabled={!ready || busy}>
            {busy ? "Oppdaterer..." : "Oppdater passord"}
          </button>
        </form>

        {status ? (
          <div className={`${styles.status} ${statusError ? styles.statusError : ""}`}>
            {status}
          </div>
        ) : null}
      </section>
    </div>
  );
}
