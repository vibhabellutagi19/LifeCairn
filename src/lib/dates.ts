import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function shiftDateISO(dateISO: string, days: number) {
  return toISO(addDays(new Date(`${dateISO}T00:00:00`), days));
}

export function currentMonthKey() {
  return format(new Date(), "yyyy-MM");
}

export function weekRangeISO(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return {
    start: toISO(startOfWeek(d, { weekStartsOn: 1 })),
    end: toISO(endOfWeek(d, { weekStartsOn: 1 })),
  };
}

export function monthRangeISO(monthKey: string) {
  const d = new Date(`${monthKey}-01T00:00:00`);
  return {
    start: toISO(startOfMonth(d)),
    end: toISO(endOfMonth(d)),
  };
}

export function daysInMonthISO(monthKey: string) {
  const { start, end } = monthRangeISO(monthKey);
  return eachDayOfInterval({
    start: new Date(`${start}T00:00:00`),
    end: new Date(`${end}T00:00:00`),
  }).map(toISO);
}

export function shiftMonthKey(monthKey: string, months: number) {
  const d = new Date(`${monthKey}-01T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return format(d, "yyyy-MM");
}
