import type { AppData } from "@/types";
import { mondayOf, weeksBetween } from "./time";

// Live workspaces run on the real calendar. Every stored week number is relative to
// `data.today` (week 0 = this week), so when real weeks pass, those numbers must move
// back by the same amount. Dates and timestamps are absolute and never change.

/** Weeks of history kept after a roll-forward; older relative-week records are dropped. */
export const KEEP_HISTORY_WEEKS = 26;

function shiftKey(key: string, k: number): string {
  // suggestionKey format: kitchenId:week:dayIndex:fromDishId:reason
  const parts = key.split(":");
  if (parts.length < 5) return key;
  const week = Number(parts[1]);
  if (!Number.isFinite(week)) return key;
  parts[1] = String(week - k);
  return parts.join(":");
}

/** Move the workspace to a new `today`, shifting relative weeks when the week changes. */
export function rollForward(data: AppData, newToday: string): AppData {
  const k = weeksBetween(mondayOf(data.today), mondayOf(newToday));
  if (k <= 0) return data.today === newToday || k < 0 ? data : { ...data, today: newToday };
  const keep = (w: number) => w >= -KEEP_HISTORY_WEEKS;
  return {
    ...data,
    today: newToday,
    commitments: data.commitments
      .map((c) => ({ ...c, weeks: c.weeks.map((w) => w - k).filter(keep) }))
      .filter((c) => c.weeks.length > 0),
    overrides: data.overrides.map((o) => ({ ...o, week: o.week - k })).filter((o) => keep(o.week)),
    decisions: data.decisions.map((d) => ({ ...d, key: shiftKey(d.key, k) })),
    switchRequests: data.switchRequests
      .map((r) => ({ ...r, weeks: r.weeks.map((w) => w - k).filter(keep) }))
      .filter((r) => r.weeks.length > 0),
    batches: data.batches.map((b) => ({ ...b, week: b.week - k })),
  };
}
