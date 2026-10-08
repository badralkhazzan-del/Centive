import type { Lang } from "@/types";
import { parseISO } from "./time";

// Locale-aware formatting without Intl surprises across browsers and Node:
// EN uses "," for thousands, ID uses ".".

export function formatNumber(value: number, lang: Lang, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const sep = lang === "id" ? "." : ",";
  const dec = lang === "id" ? "," : ".";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  return sign + grouped + (frac ? dec + frac : "");
}

export function formatRp(value: number, lang: Lang): string {
  return `Rp ${formatNumber(Math.round(value), lang)}`;
}

/** Compact Rupiah for KPI tiles: Rp 12.4 M (juta) / Rp 1.2 B (miliar). */
export function formatRpCompact(value: number, lang: Lang): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `Rp ${formatNumber(value / 1e9, lang, 2)} ${lang === "id" ? "M" : "B"}`;
  if (abs >= 1e6) return `Rp ${formatNumber(value / 1e6, lang, 1)} ${lang === "id" ? "jt" : "M"}`;
  return formatRp(value, lang);
}

export function formatPct(fraction: number, lang: Lang, decimals = 0): string {
  return `${formatNumber(fraction * 100, lang, decimals)}%`;
}

export function formatKg(value: number, lang: Lang, unit = "kg"): string {
  const decimals = Math.abs(value) < 10 && value % 1 !== 0 ? 1 : 0;
  return `${formatNumber(value, lang, decimals)} ${unit}`;
}

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
};

const DAYS: Record<Lang, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  id: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
};

const DAYS_LONG: Record<Lang, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
};

export function formatDate(iso: string, lang: Lang, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseISO(iso);
  const parts = [`${d.getUTCDate()} ${MONTHS[lang][d.getUTCMonth()]}`];
  if (opts.year) parts.push(String(d.getUTCFullYear()));
  const base = parts.join(" ");
  return opts.weekday ? `${DAYS[lang][d.getUTCDay()]} ${base}` : base;
}

export function weekdayName(iso: string, lang: Lang, long = false): string {
  const d = parseISO(iso).getUTCDay();
  return (long ? DAYS_LONG : DAYS)[lang][d];
}

export function formatDateRange(fromIso: string, toIso: string, lang: Lang): string {
  return `${formatDate(fromIso, lang)} – ${formatDate(toIso, lang)}`;
}

export function formatTime(isoDateTime: string): string {
  return isoDateTime.slice(11, 16);
}

export function formatDateTime(isoDateTime: string, lang: Lang): string {
  return `${formatDate(isoDateTime.slice(0, 10), lang, { weekday: true })}, ${formatTime(isoDateTime)}`;
}

/** "weeks 3–6" style range from a sorted list. */
export function formatWeeks(weeks: number[], lang: Lang): string {
  if (weeks.length === 0) return "";
  const sorted = [...weeks].sort((a, b) => a - b);
  const contiguous = sorted.every((w, i) => i === 0 || w === sorted[i - 1] + 1);
  const label = lang === "id" ? "minggu" : sorted.length > 1 ? "weeks" : "week";
  if (sorted.length === 1) return `${label} ${sorted[0]}`;
  if (contiguous) return `${label} ${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `${label} ${sorted.join(", ")}`;
}
