"use client";

import { useMemo, useState } from "react";
import styles from "@/components/kroner.module.css";
import { Topbar } from "@/components/Topbar";
import type {
  AppAccount,
  BankReportingTreatment,
  BankTransactionKind,
  KnownBankRule,
  Workspace
} from "@/lib/types";

const TRANSACTION_KIND_OPTIONS: Array<{ value: BankTransactionKind; label: string }> = [
  { value: "vipps", label: "Vipps" },
  { value: "bank_transfer", label: "Bankoverføring" },
  { value: "subscription_expense", label: "Fast utgift / abonnement" },
  { value: "subscription_income", label: "Fast inntekt" },
  { value: "invoice_income", label: "Fakturainnbetaling" },
  { value: "invoice_expense", label: "Fakturautbetaling" },
  { value: "salary_or_fee", label: "Lønn / honorar" },
  { value: "card_purchase", label: "Kortkjøp" },
  { value: "other", label: "Annet" }
];

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function KnownRulesClient({
  accountId,
  accountSlug,
  accounts,
  currentAccountId,
  currentAccountName,
  currentWorkspaceId,
  currentWorkspaceName,
  currentPath,
  selectedMonthKey,
  workspaces,
  initialRules
}: {
  accountId: string;
  accountSlug: string;
  accounts: AppAccount[];
  currentAccountId: string;
  currentAccountName: string;
  currentWorkspaceId: string;
  currentWorkspaceName?: string;
  currentPath: string;
  selectedMonthKey: string;
  workspaces: Workspace[];
  initialRules: KnownBankRule[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [patterns, setPatterns] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [entryType, setEntryType] = useState<"" | "income" | "expense">("expense");
  const [transactionKind, setTransactionKind] = useState<BankTransactionKind>("subscription_expense");
  const [cat, setCat] = useState("Abonnementer");
  const [workspaceId, setWorkspaceId] = useState("");
  const [confidenceScore, setConfidenceScore] = useState("99");
  const [reportingTreatment, setReportingTreatment] = useState<BankReportingTreatment>("normal");
  const [autoApply, setAutoApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  function resetForm() {
    setEditingRuleId(null);
    setLabel("");
    setPatterns("");
    setPaymentType("");
    setEntryType("expense");
    setTransactionKind("subscription_expense");
    setCat("Abonnementer");
    setWorkspaceId("");
    setConfidenceScore("99");
    setReportingTreatment("normal");
    setAutoApply(true);
  }

  function loadRuleIntoForm(rule: KnownBankRule) {
    setEditingRuleId(rule.id);
    setLabel(rule.label);
    setPatterns(rule.normalizedIncludes.join(", "));
    setPaymentType(rule.paymentType ?? "");
    setEntryType((rule.entryType ?? "") as "" | "income" | "expense");
    setTransactionKind(rule.transactionKind);
    setCat(rule.cat);
    setWorkspaceId(rule.workspaceId ?? "");
    setConfidenceScore(String(rule.confidenceScore));
    setReportingTreatment(rule.reportingTreatment);
    setAutoApply(rule.autoApply);
    setStatus("");
  }

  const filteredRules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rules.filter((rule) =>
      !normalized ||
      [rule.label, rule.cat, rule.paymentType ?? "", ...rule.normalizedIncludes]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, rules]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/bank-known-rules", {
        method: editingRuleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          id: editingRuleId,
          label,
          normalizedIncludes: patterns
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          paymentType: paymentType || null,
          entryType: entryType || null,
          transactionKind,
          cat,
          workspaceId: workspaceId || null,
          confidenceScore: Number(confidenceScore),
          reportingTreatment,
          autoApply
        })
      });

      const json = (await response.json()) as { message?: string; rule?: KnownBankRule };
      if (!response.ok || !json.rule) {
        throw new Error(json.message || "Could not save rule.");
      }

      setRules((current) =>
        editingRuleId
          ? current.map((rule) => (rule.id === editingRuleId ? (json.rule as KnownBankRule) : rule))
          : [json.rule as KnownBankRule, ...current]
      );
      resetForm();
      setStatus(editingRuleId ? "Regel oppdatert." : "Regel lagret.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save rule.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/bank-known-rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, id })
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message || "Could not delete rule.");
      }

      setRules((current) => current.filter((rule) => rule.id !== id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar
        accountSlug={accountSlug}
        accounts={accounts}
        currentAccountId={currentAccountId}
        currentAccountName={currentAccountName}
        currentPath={currentPath}
        currentWorkspaceId={currentWorkspaceId}
        currentWorkspaceName={currentWorkspaceName}
        monthKey={selectedMonthKey}
        onSearchChange={setQuery}
        searchValue={query}
        title="Regler"
        workspaces={workspaces}
      />
      <div className={styles.content}>
        <div className={styles.page}>
          <section className={styles.card}>
            <div className={styles.cardLabel}>Legg til kjent regel</div>
            <form className={styles.modalForm} onSubmit={handleCreate}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Navn</label>
                  <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Betalingstype</label>
                  <input
                    className={styles.input}
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    placeholder="f.eks. Lønn eller Avtalegiro"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Tekstmønstre</label>
                <input
                  className={styles.input}
                  value={patterns}
                  onChange={(e) => setPatterns(e.target.value)}
                  placeholder="f.eks. CURSOR, ANYSPHERE"
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Retning</label>
                  <select className={styles.select} value={entryType} onChange={(e) => setEntryType(e.target.value as "" | "income" | "expense")}>
                    <option value="">Begge</option>
                    <option value="expense">Utgift</option>
                    <option value="income">Inntekt</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Transaksjonstype</label>
                  <select className={styles.select} value={transactionKind} onChange={(e) => setTransactionKind(e.target.value as BankTransactionKind)}>
                    {TRANSACTION_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Kategori</label>
                  <input className={styles.input} value={cat} onChange={(e) => setCat(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Prosjekt/selskap</label>
                  <select className={styles.select} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
                    <option value="">Ikke lås</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Sikkerhet</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    max="100"
                    value={confidenceScore}
                    onChange={(e) => setConfidenceScore(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Rapportering</label>
                  <select className={styles.select} value={reportingTreatment} onChange={(e) => setReportingTreatment(e.target.value as BankReportingTreatment)}>
                    <option value="normal">Normal</option>
                    <option value="offset_hidden">Skjul i totalsummer</option>
                  </select>
                </div>
              </div>
              <label className={styles.txMetaCompact}>
                <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
                <span className={styles.txMetaItem}>Auto-apply denne regelen</span>
              </label>
              <div className={styles.modalActions}>
                {editingRuleId ? (
                  <button
                    className={styles.modalCancel}
                    disabled={busy}
                    onClick={resetForm}
                    type="button"
                  >
                    Avbryt redigering
                  </button>
                ) : null}
                <button className={styles.modalPrimary} disabled={busy} type="submit">
                  {busy ? "Lagrer..." : editingRuleId ? "Oppdater regel" : "Lagre regel"}
                </button>
              </div>
            </form>
          </section>

          <div className={styles.sectionDivider}>Kjente regler</div>
          <div className={styles.entryList}>
            {filteredRules.map((rule) => (
              <article className={styles.bankImportCard} key={rule.id}>
                <div className={styles.bankImportCardTop}>
                  <div>
                    <div className={styles.txName}>{rule.label}</div>
                    <div className={styles.txNote}>{rule.normalizedIncludes.join(" · ") || "Ingen tekstmønstre"}</div>
                  </div>
                  <button className={cx(styles.modalCancel)} disabled={busy} onClick={() => handleDelete(rule.id)} type="button">
                    Slett
                  </button>
                  <button className={cx(styles.modalPrimary)} disabled={busy} onClick={() => loadRuleIntoForm(rule)} type="button">
                    Rediger
                  </button>
                </div>
                <div className={styles.bankImportMetaRow}>
                  <span className={styles.txMetaItem}>{rule.paymentType || "Alle betalingstyper"}</span>
                  <span className={styles.txMetaItem}>{rule.entryType || "Begge retninger"}</span>
                  <span className={styles.txMetaItem}>{rule.transactionKind}</span>
                  <span className={styles.txMetaItem}>{rule.cat}</span>
                  <span className={styles.txMetaItem}>{rule.confidenceScore}%</span>
                  <span className={styles.txMetaItem}>{rule.autoApply ? "Auto" : "Review"}</span>
                </div>
              </article>
            ))}
            {filteredRules.length === 0 ? (
              <div className={styles.emptyState}>Ingen kjente regler ennå.</div>
            ) : null}
          </div>

          {status ? <div className={styles.statusText}>{status}</div> : null}
        </div>
      </div>
    </>
  );
}
