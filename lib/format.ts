import { formatMonthLabel as formatMonthLabelValue } from "@/lib/month";

export function formatCurrency(amount: number) {
  return `${Math.abs(Math.round(amount)).toLocaleString("no-NO")} kr`;
}

export function formatSignedCurrency(amount: number) {
  return `${amount >= 0 ? "+" : "−"} ${formatCurrency(amount)}`;
}

export function formatMonthLabel(date: string | Date = new Date()) {
  return formatMonthLabelValue(date);
}
