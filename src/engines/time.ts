// Calendar helpers. All dates are ISO strings (yyyy-mm-dd) handled in UTC so the
// app behaves the same in every time zone.
//
// Week numbering: week 0 is the week that contains `today`. Planning weeks 1..8
// are the eight school weeks ahead. Negative weeks are history.

/** Reference date of the sample region for tests and server prerendering (a Monday). Live data uses the real date. */
export const SAMPLE_DATE = "2026-10-26";

const DAY_MS = 86_400_000;

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * DAY_MS));
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / DAY_MS);
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(iso: string): number {
  const d = parseISO(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export function mondayOf(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

/** Monday of a planning week relative to today. */
export function weekStart(today: string, week: number): string {
  return addDays(mondayOf(today), week * 7);
}

/** Date of a school day in a week. dow: 0 = Monday ... 4 = Friday. */
export function schoolDayDate(today: string, week: number, dow: number): string {
  return addDays(weekStart(today, week), dow);
}

/** Planning week that contains a date. */
export function weekOfDate(today: string, iso: string): number {
  return Math.floor(daysBetween(mondayOf(today), iso) / 7);
}

/** Which week (1..4) of the 4-week menu cycle a planning week uses. Week 1 = cycle week 1. */
export function cycleWeekOf(week: number): number {
  return ((((week - 1) % 4) + 4) % 4) + 1;
}

/** Menu-cycle day index (1..20) for a planning week and weekday (0..4). `offset` shifts the cycle (see cycleOffset). */
export function cycleDayIndex(week: number, dow: number, offset = 0): number {
  return (cycleWeekOf(week + offset) - 1) * 5 + dow + 1;
}

/** Weeks between two Mondays (can be negative). */
export function weeksBetween(fromMonday: string, toMonday: string): number {
  return Math.round(daysBetween(mondayOf(fromMonday), mondayOf(toMonday)) / 7);
}

/** Cycle offset so that the week starting on `anchorMonday` is cycle week 1. */
export function cycleOffset(today: string, anchorMonday?: string): number {
  if (!anchorMonday) return 0;
  return weeksBetween(anchorMonday, weekStart(today, 1));
}

/** Weekday (0..4) of a cycle day index. */
export function dowOfDayIndex(dayIndex: number): number {
  return (dayIndex - 1) % 5;
}

export function monthIndex(iso: string): number {
  return parseISO(iso).getUTCMonth();
}

export function isoAt(dateIso: string, hhmm: string): string {
  return `${dateIso}T${hhmm}:00.000Z`;
}
