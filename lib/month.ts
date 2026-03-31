import { MONTHS } from "@/lib/types";

export type MonthParts = {
  key: string;
  year: number;
  monthIndex: number;
};

function padMonth(value: number) {
  return String(value).padStart(2, "0");
}

export function getCurrentMonthKey() {
  return formatMonthKey(new Date());
}

export function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`;
}

export function parseMonthKey(value?: string | null): MonthParts | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!Number.isInteger(year) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  return {
    key: `${year}-${padMonth(monthNumber)}`,
    year,
    monthIndex: monthNumber - 1
  };
}

export function getMonthDate(parts: MonthParts) {
  return new Date(parts.year, parts.monthIndex, 1);
}

export function shiftMonthKey(value: string, direction: -1 | 1) {
  const parsed = parseMonthKey(value) ?? parseMonthKey(getCurrentMonthKey());
  if (!parsed) {
    return getCurrentMonthKey();
  }

  const date = new Date(parsed.year, parsed.monthIndex + direction, 1);
  return formatMonthKey(date);
}

export function getMonthBounds(value: string) {
  const parsed = parseMonthKey(value) ?? parseMonthKey(getCurrentMonthKey());
  if (!parsed) {
    const now = new Date();
    return {
      start: `${now.getFullYear()}-${padMonth(now.getMonth() + 1)}-01`,
      end: `${now.getFullYear()}-${padMonth(now.getMonth() + 1)}-31`
    };
  }

  const startDate = new Date(parsed.year, parsed.monthIndex, 1);
  const endDate = new Date(parsed.year, parsed.monthIndex + 1, 0);

  return {
    start: `${startDate.getFullYear()}-${padMonth(startDate.getMonth() + 1)}-${padMonth(startDate.getDate())}`,
    end: `${endDate.getFullYear()}-${padMonth(endDate.getMonth() + 1)}-${padMonth(endDate.getDate())}`
  };
}

export function formatMonthLabel(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : getMonthDate(parseMonthKey(value) ?? parseMonthKey(getCurrentMonthKey())!);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function getMonthOptions(anchorKey: string, count = 6) {
  const anchor = parseMonthKey(anchorKey) ?? parseMonthKey(getCurrentMonthKey());
  if (!anchor) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1;
    const date = new Date(anchor.year, anchor.monthIndex - offset, 1);
    const key = formatMonthKey(date);

    return {
      key,
      label: formatMonthLabel(key)
    };
  });
}
