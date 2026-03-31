import type { AppAccount, Entry, RecurringItem } from "@/lib/types";

function withAccount(path: string, accountSlug: string) {
  return `${path}?account=${encodeURIComponent(accountSlug)}`;
}

export function AccountPanel({
  accounts,
  currentAccount,
  entries,
  recurringItems
}: {
  accounts: AppAccount[];
  currentAccount: AppAccount;
  entries: Entry[];
  recurringItems: RecurringItem[];
}) {
  return (
    <section className="panel">
      <div className="panelTitle">Konto</div>
      <div className="accountName">{currentAccount.name}</div>
      <div className="mutedText">
        {entries.length} transaksjoner · {recurringItems.length} faste poster
      </div>

      <div className="sectionLabel">Bytt konto</div>
      <div className="switchList">
        {accounts.map((account) => (
          <a
            key={account.id}
            href={withAccount("/", account.slug)}
            className={account.id === currentAccount.id ? "switchChip active" : "switchChip"}
          >
            {account.name}
          </a>
        ))}
      </div>
      <div className="mutedText">Hold hver bruker på sin egen konto. Workspaces lever inni kontoen din.</div>
    </section>
  );
}
