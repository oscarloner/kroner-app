import { MONTHS } from "@/lib/types";

export function formatCurrency(amount: number) {
  return `${Math.abs(Math.round(amount)).toLocaleString("no-NO")} kr`;
}

export function formatSignedCurrency(amount: number) {
  return `${amount >= 0 ? "+" : "−"} ${formatCurrency(amount)}`;
}

export function formatMonthLabel(date = new Date()) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
