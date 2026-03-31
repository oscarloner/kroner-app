import styles from "@/components/kroner.module.css";
import { formatCurrency } from "@/lib/format";
import { parseMonthKey } from "@/lib/month";
import type { Entry } from "@/lib/types";

function getLastSixMonths(selectedMonthKey: string) {
  const months: { key: string; label: string; month: number; year: number }[] = [];
  const selected = parseMonthKey(selectedMonthKey);
  const anchor = selected ? new Date(selected.year, selected.monthIndex, 1) : new Date();

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - index, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("no-NO", { month: "short" }),
      month: date.getMonth(),
      year: date.getFullYear()
    });
  }

  return months;
}

export function Charts({
  entries,
  selectedMonthKey
}: {
  entries: Entry[];
  selectedMonthKey: string;
}) {
  const months = getLastSixMonths(selectedMonthKey);
  const totals = months.map((month) => {
    const monthEntries = entries.filter((entry) => {
      const date = new Date(entry.date);
      return date.getMonth() === month.month && date.getFullYear() === month.year;
    });

    const income = monthEntries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const expense = monthEntries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0);

    return { ...month, income, expense };
  });

  const maxValue = Math.max(1, ...totals.flatMap((month) => [month.income, month.expense]));

  const selected = parseMonthKey(selectedMonthKey);
  const currentMonth = selected?.monthIndex ?? new Date().getMonth();
  const currentYear = selected?.year ?? new Date().getFullYear();
  const categoryTotals = Object.entries(
    entries
      .filter((entry) => {
        const date = new Date(entry.date);
        return (
          entry.type === "expense" &&
          date.getMonth() === currentMonth &&
          date.getFullYear() === currentYear
        );
      })
      .reduce<Record<string, number>>((accumulator, entry) => {
        accumulator[entry.cat] = (accumulator[entry.cat] ?? 0) + entry.amount;
        return accumulator;
      }, {})
  ).sort((left, right) => right[1] - left[1]);

  return (
    <>
      <section className={styles.chartWrap}>
        <div className={styles.chartTitle}>Månedlig oversikt — siste 6 måneder</div>
        <div className={styles.barChart}>
          {totals.map((month) => (
            <div key={month.key} className={styles.barGroup}>
              <div className={styles.barStack}>
                <div
                  className={`${styles.bar} ${styles.barIncome}`}
                  style={{ height: `${(month.income / maxValue) * 100}%` }}
                  title={`Inntekter: ${formatCurrency(month.income)}`}
                />
                <div
                  className={`${styles.bar} ${styles.barExpense}`}
                  style={{ height: `${(month.expense / maxValue) * 100}%` }}
                  title={`Utgifter: ${formatCurrency(month.expense)}`}
                />
              </div>
              <div className={styles.barLabel}>{month.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.chartWrap}>
        <div className={styles.chartTitle}>Utgiftsfordeling denne måneden</div>
        <div className={styles.categoryList}>
          {categoryTotals.length === 0 ? (
            <div className={styles.emptyState}>Ingen utgifter denne måneden.</div>
          ) : (
            categoryTotals.map(([category, amount]) => (
              <div className={styles.categoryRow} key={category}>
                <span>{category}</span>
                <strong>{formatCurrency(amount)}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
