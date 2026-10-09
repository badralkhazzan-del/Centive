"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { formatNumber } from "@/engines/format";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { settingsStrings, type SettingsStrings } from "./strings";

/**
 * pct: stored as a fraction (0.95), shown as 95%. pm: same, shown as ±10%.
 * The other units are stored and shown as they are.
 */
export type FieldUnit = "pct" | "pm" | "days" | "weeks" | "g" | "times";

export interface SettingFieldProps {
  id: string;
  label: string;
  /** Stored value (a fraction for percentages). */
  value: number;
  defaultValue: number;
  /** Bounds and step in display units (95 for 95%). */
  min: number;
  max: number;
  step?: number;
  unit: FieldUnit;
  onCommit: (stored: number) => void;
}

const COMMIT_DELAY_MS = 350;

const isPct = (unit: FieldUnit) => unit === "pct" || unit === "pm";
const toDisplay = (unit: FieldUnit, stored: number) => (isPct(unit) ? Math.round(stored * 10000) / 100 : stored);
const toStored = (unit: FieldUnit, shown: number) => (isPct(unit) ? Number((shown / 100).toFixed(4)) : shown);

function suffixOf(unit: FieldUnit, L: SettingsStrings) {
  switch (unit) {
    case "pct":
    case "pm":
      return "%";
    case "days":
      return L.daysUnit;
    case "weeks":
      return L.weeksUnit;
    case "g":
      return "g";
    case "times":
      return "×";
  }
}

export function formatSetting(unit: FieldUnit, shown: number, lang: "en" | "id", L: SettingsStrings) {
  const n = formatNumber(shown, lang, Number.isInteger(shown) ? 0 : 1);
  switch (unit) {
    case "pct":
      return `${n}%`;
    case "pm":
      return `±${n}%`;
    case "g":
      return `${n} g`;
    case "times":
      return `${n}×`;
    case "days":
      return `${n} ${shown === 1 ? L.dayUnit : L.daysUnit}`;
    default:
      return `${n} ${suffixOf(unit, L)}`;
  }
}

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * One threshold: a range slider and a number box that stay in sync, with the live
 * value, the allowed range and the default. Changes are saved shortly after the
 * user stops moving the slider or typing, so dragging writes one audit entry.
 */
export function SettingField({ id, label, value, defaultValue, min, max, step = 1, unit, onCommit }: SettingFieldProps) {
  const { lang } = useT();
  const L = settingsStrings(lang);
  const [pending, setPending] = useState<number | null>(null);
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pendingRef = useRef<number | null>(null);
  const commitRef = useRef(onCommit);

  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

  // Save a change that is still waiting when the field unmounts (e.g. tab switch).
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      if (pendingRef.current !== null) commitRef.current(toStored(unit, pendingRef.current));
      pendingRef.current = null;
    };
  }, [unit]);

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const v = pendingRef.current;
    pendingRef.current = null;
    if (v !== null) commitRef.current(toStored(unit, v));
    setPending(null);
  };

  const schedule = (shown: number) => {
    pendingRef.current = shown;
    setPending(shown);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, COMMIT_DELAY_MS);
  };

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  const stored = toDisplay(unit, value);
  const shown = pending ?? stored;
  const parsed = text === null ? null : parseNumber(text);
  const invalid = text !== null && (parsed === null || parsed < min || parsed > max);
  const modified = pending === null && Math.abs(value - defaultValue) > 1e-9;
  const fmt = (n: number) => formatSetting(unit, n, lang, L);
  const suffix = suffixOf(unit, L);
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;

  return (
    <div className="grid gap-1" data-testid={`setting-${id}`}>
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={id} className="leading-snug">
          {label}
        </Label>
        <output htmlFor={`${id} ${id}-num`} className="shrink-0 text-lg leading-tight font-extrabold tabular-nums text-primary-strong">
          {fmt(shown)}
        </output>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={shown}
          aria-valuetext={fmt(shown)}
          aria-describedby={hintId}
          onChange={(e) => schedule(Number(e.target.value))}
          onBlur={() => (pendingRef.current !== null ? flush() : undefined)}
          className="mr-1 h-11 min-w-0 flex-1 cursor-pointer rounded-full accent-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        />
        <div className="relative w-[6.5rem] shrink-0">
          <Input
            id={`${id}-num`}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={text ?? String(shown)}
            aria-label={`${label} (${suffix})`}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${errId} ${hintId}` : hintId}
            onChange={(e) => {
              const raw = e.target.value;
              setText(raw);
              const n = parseNumber(raw);
              if (n !== null && n >= min && n <= max) schedule(n);
            }}
            onBlur={() => {
              if (text !== null) {
                const n = parseNumber(text);
                if (n !== null && clamp(n) !== shown) schedule(clamp(n));
                setText(null);
              }
              if (pendingRef.current !== null) flush();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={cn(
              "[appearance:textfield] pr-12 pl-2 text-right tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              invalid && "border-danger ring-[3px] ring-danger/30",
            )}
          />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm font-semibold text-muted">
            {suffix}
          </span>
        </div>
        {/* Reserved space keeps the slider width stable; hidden (and out of the tab order) at the default value. */}
        <button
          type="button"
          onClick={() => onCommit(defaultValue)}
          disabled={!modified}
          aria-label={L.restoreDefaultFor(label)}
          title={L.restoreDefault}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            !modified && "invisible",
          )}
        >
          <RotateCcw className="size-5" aria-hidden />
        </button>
      </div>
      {invalid ? (
        <p id={errId} role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-danger-strong">
          <CircleAlert className="size-4 shrink-0" aria-hidden /> {L.outOfRange(fmt(min), fmt(max))}
        </p>
      ) : null}
      <p id={hintId} className="text-xs text-muted">
        {L.range(fmt(min), fmt(max))} · {L.defaultValue(fmt(toDisplay(unit, defaultValue)))}
      </p>
    </div>
  );
}
