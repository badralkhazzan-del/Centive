"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { IngredientLabel } from "@/components/common/ingredient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDate, formatRp } from "@/engines/format";
import { mondayOf, parseISO, toISO } from "@/engines/time";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import type { PriceEntry } from "@/lib/repo/manage";
import type { Ingredient, PricePoint, PriceSource } from "@/types";
import { useFoodStrings } from "./food-strings";
import { EmptyList, Section, SelectField, usePermissions, useSave } from "./parts";

/** Latest price point per ingredient with weekStart on or before `monday`. */
function latestPrices(prices: PricePoint[], monday: string): Map<string, PricePoint> {
  const out = new Map<string, PricePoint>();
  for (const p of prices) {
    if (p.weekStart > monday) continue;
    const prev = out.get(p.ingredientId);
    if (!prev || p.weekStart > prev.weekStart) out.set(p.ingredientId, p);
  }
  return out;
}

/** "28.500", "28,500", "Rp 28500" -> 28500. Returns NaN when it is not a price. */
function parsePrice(raw: string): number {
  const s = raw.replace(/rp\.?/i, "").replace(/\s/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  if (/^\d+([.,]\d+)?$/.test(s)) return Number(s.replace(",", "."));
  return NaN;
}

function isDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s;
}

type ParsedLine = { line: number; text: string; error: string };

function parsePaste(text: string, ingredients: Ingredient[], errors: { columns: string; ingredient: string; date: string; price: string }) {
  const byKey = new Map<string, string>();
  for (const i of ingredients) for (const k of [i.id, i.nameEn, i.nameId]) byKey.set(k.trim().toLowerCase(), i.id);
  const entries: Omit<PriceEntry, "source">[] = [];
  const invalid: ParsedLine[] = [];
  let seenContent = false;
  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const first = !seenContent;
    seenContent = true;
    let cells = line.includes("\t") ? line.split("\t") : line.includes(";") ? line.split(";") : line.split(",");
    if (!line.includes("\t") && !line.includes(";") && cells.length > 3) cells = [cells[0], cells[1], cells.slice(2).join("")];
    cells = cells.map((c) => c.trim());
    const ingredientId = byKey.get((cells[0] ?? "").toLowerCase());
    const date = cells[1] ?? "";
    const price = parsePrice(cells[2] ?? "");
    if (first && !ingredientId && !isDate(date) && !Number.isFinite(price)) return; // header line
    const error =
      cells.length !== 3 ? errors.columns : !ingredientId ? errors.ingredient : !isDate(date) ? errors.date : !(price > 0) ? errors.price : "";
    if (error || !ingredientId) invalid.push({ line: idx + 1, text: line, error });
    else entries.push({ ingredientId, weekStart: mondayOf(date), priceRpPerKg: Math.round(price) });
  });
  return { entries, invalid };
}

function SourceBadge({ source }: { source: PriceSource }) {
  const { t } = useT();
  return source === "PIHPS" ? <Badge variant="green">{t.manage.prices.pihps}</Badge> : <Badge variant="muted">{t.manage.prices.placeholder}</Badge>;
}

function SourceSelect({ id, value, onChange }: { id: string; value: PriceSource; onChange: (v: PriceSource) => void }) {
  const { t } = useT();
  return (
    <SelectField id={id} label={t.manage.prices.source} value={value} onChange={(e) => onChange(e.target.value as PriceSource)} className="sm:max-w-xs">
      <option value="PIHPS">{t.manage.prices.pihps}</option>
      <option value="PLACEHOLDER">{t.manage.prices.placeholder}</option>
    </SelectField>
  );
}

function WeekEntry({ thisMonday, canEdit }: { thisMonday: string; canEdit: boolean }) {
  const { t, lang } = useT();
  const s = useFoodStrings();
  const data = useAppData();
  const save = useSave();
  const L = t.manage.prices;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [source, setSource] = useState<PriceSource>("PIHPS");
  const latest = useMemo(() => latestPrices(data.prices, thisMonday), [data.prices, thisMonday]);

  const changed: PriceEntry[] = [];
  for (const ing of data.ingredients) {
    const p = latest.get(ing.id);
    const raw = drafts[ing.id] ?? (p ? String(p.priceRpPerKg) : "");
    const value = parsePrice(raw);
    if (!(value > 0)) continue;
    if (p?.weekStart !== thisMonday || Math.round(value) !== p.priceRpPerKg) changed.push({ ingredientId: ing.id, weekStart: thisMonday, priceRpPerKg: Math.round(value) });
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5">
      <h3 className="text-lg font-bold">{s.thisWeek(formatDate(thisMonday, lang, { weekday: true, year: true }))}</h3>
      <ul className="grid gap-2" data-testid="price-rows">
        {data.ingredients.map((ing) => {
          const p = latest.get(ing.id);
          const inputId = `price-${ing.id}`;
          return (
            <li
              key={ing.id}
              className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem] sm:items-center"
              data-testid={`price-row-${ing.id}`}
            >
              <div className="min-w-0">
                <span id={`${inputId}-name`}>
                  <IngredientLabel ingredient={ing} className="font-bold" />
                </span>
                <span className="ml-1 text-sm text-muted">/ {ing.unit}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">{L.latest}:</span>
                {p ? (
                  <>
                    <span className="font-semibold tabular-nums">{formatRp(p.priceRpPerKg, lang)}</span>
                    <span className="text-muted">{formatDate(p.weekStart, lang)}</span>
                    <SourceBadge source={p.source} />
                  </>
                ) : (
                  <span className="text-muted">{s.noPrice}</span>
                )}
              </div>
              {canEdit ? (
                <div className="grid gap-1">
                  <Label htmlFor={inputId} id={`${inputId}-label`} className="text-xs">
                    {s.priceThisWeek}
                  </Label>
                  <Input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={50}
                    aria-labelledby={`${inputId}-label ${inputId}-name`}
                    value={drafts[ing.id] ?? (p ? String(p.priceRpPerKg) : "")}
                    onChange={(e) => setDrafts((d) => ({ ...d, [ing.id]: e.target.value }))}
                    className="tabular-nums"
                    data-testid={`price-input-${ing.id}`}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-3">
          <SourceSelect id="price-week-source" value={source} onChange={setSource} />
          <Button
            disabled={changed.length === 0}
            onClick={() => {
              save("setPrices", [changed, source]);
              setDrafts({});
            }}
            data-testid="price-save-week"
          >
            {L.saveWeek}
          </Button>
          <p className="text-sm text-muted" aria-live="polite">
            {changed.length > 0 ? s.toSave(changed.length) : s.nothingToSave}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function History({ thisMonday }: { thisMonday: string }) {
  const { lang, nm } = useT();
  const s = useFoodStrings();
  const data = useAppData();
  const [picked, setPicked] = useState(() => (data.ingredients.some((i) => i.id === "eggs") ? "eggs" : (data.ingredients[0]?.id ?? "")));
  const points = data.prices
    .filter((p) => p.ingredientId === picked && p.weekStart <= thisMonday)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-8);
  const max = Math.max(1, ...points.map((p) => p.priceRpPerKg));

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5">
      <div>
        <h3 className="text-lg font-bold">{s.history}</h3>
        <p className="text-sm text-muted">{s.historyHint}</p>
      </div>
      <SelectField id="price-history-ingredient" label={s.ingredient} value={picked} onChange={(e) => setPicked(e.target.value)} className="sm:max-w-xs">
        {data.ingredients.map((i) => (
          <option key={i.id} value={i.id}>
            {i.emoji} {nm(i)}
          </option>
        ))}
      </SelectField>
      {points.length === 0 ? (
        <p className="text-sm text-muted">{s.noHistory}</p>
      ) : (
        <ol className="grid gap-1.5" data-testid="price-history">
          {points.map((p) => (
            <li key={p.weekStart} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <span className="text-muted">{formatDate(p.weekStart, lang, { year: true })}</span>
              <span className="h-3 rounded-full bg-muted-surface" aria-hidden>
                <span className="block h-3 rounded-full bg-primary" style={{ width: `${Math.max(4, (p.priceRpPerKg / max) * 100)}%` }} />
              </span>
              <span className="font-semibold tabular-nums">{formatRp(p.priceRpPerKg, lang)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PasteImport() {
  const { t } = useT();
  const s = useFoodStrings();
  const data = useAppData();
  const save = useSave();
  const L = t.manage.prices;
  const [text, setText] = useState("");
  const [source, setSource] = useState<PriceSource>("PIHPS");
  const { entries, invalid } = useMemo(
    () => parsePaste(text, data.ingredients, { columns: s.badColumns, ingredient: s.badIngredient, date: s.badDate, price: s.badPrice }),
    [text, data.ingredients, s],
  );

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5">
      <h3 className="text-lg font-bold">{L.paste}</h3>
      <div className="grid gap-1.5">
        <Label htmlFor="price-paste">{s.pasteLabel}</Label>
        <textarea
          id="price-paste"
          aria-describedby="price-paste-hint"
          rows={5}
          value={text}
          placeholder={s.pastePlaceholder}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          data-testid="price-paste"
        />
        <p id="price-paste-hint" className="text-xs text-muted">
          {L.pasteHint}
        </p>
      </div>
      {text.trim() ? (
        <div className="grid gap-1 text-sm" aria-live="polite" data-testid="price-paste-summary">
          <p className="font-semibold text-ok-strong">{s.validRows(entries.length)}</p>
          {invalid.length > 0 ? (
            <>
              <p className="font-semibold text-danger-strong">{s.invalidRows(invalid.length)}</p>
              <ul className="grid gap-1">
                {invalid.map((l) => (
                  <li key={l.line} className="break-words rounded-lg bg-danger-soft px-2 py-1">
                    <span className="font-semibold">{s.lineN(l.line)}</span>: <code className="break-all">{l.text}</code> ({l.error})
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <SourceSelect id="price-paste-source" value={source} onChange={setSource} />
        <Button
          variant="outline"
          disabled={entries.length === 0}
          onClick={() => {
            save("setPrices", [entries, source], L.imported(entries.length));
            setText("");
          }}
          data-testid="price-import"
        >
          <Upload aria-hidden /> {L.import}
        </Button>
      </div>
    </div>
  );
}

export function PricesTab() {
  const { t } = useT();
  const s = useFoodStrings();
  const data = useAppData();
  const { canEditPrices } = usePermissions();
  const thisMonday = mondayOf(data.today);

  return (
    <Section title={t.manage.prices.title} hint={t.manage.prices.hint}>
      {!canEditPrices ? <p className="text-sm text-muted">{s.readOnlyPrices}</p> : null}
      {data.ingredients.length === 0 ? (
        <EmptyList />
      ) : (
        <>
          <WeekEntry thisMonday={thisMonday} canEdit={canEditPrices} />
          <div className="grid gap-4 lg:grid-cols-2">
            <History thisMonday={thisMonday} />
            {canEditPrices ? <PasteImport /> : null}
          </div>
        </>
      )}
    </Section>
  );
}
