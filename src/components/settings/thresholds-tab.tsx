"use client";

import { useState } from "react";
import { ArrowLeftRight, ChevronDown, CircleAlert, Info, Languages, Shield, Tag, TrendingUp, Users, Wallet, type LucideIcon } from "lucide-react";
import type { Lang, Settings, SubstitutionSettings } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { IngredientLabel } from "@/components/common/ingredient";
import { StatusPill } from "@/components/common/status";
import { DEFAULT_SETTINGS } from "@/data/seed";
import { formatNumber, formatPct, formatRp } from "@/engines/format";
import { useT } from "@/i18n";
import { actions, repo, useDerived, useLiveMode, useLiveUser } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { IconTile } from "./parts";
import { SettingField } from "./setting-field";
import { settingsStrings } from "./strings";

const D = DEFAULT_SETTINGS;

function save(patch: Partial<Settings>) {
  actions.updateSettings(patch);
}

function saveSub(patch: Partial<SubstitutionSettings>) {
  // Always merge with the latest saved rules, not the ones from the last render.
  actions.updateSettings({ substitution: { ...repo.getState().settings.substitution, ...patch } });
}

function SectionCard({
  icon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <IconTile icon={icon} />
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid flex-1 content-start gap-3">{children}</CardContent>
    </Card>
  );
}

/** Visual of the band around the 4-week average (scale 50% to 150%). */
function BandPreview({ floor, ceiling, lang }: { floor: number; ceiling: number; lang: Lang }) {
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v - 0.5) * 100))}%`;
  const pct = (v: number) => `${formatNumber(v * 100, lang)}%`;
  return (
    <div aria-hidden className="rounded-xl bg-muted-surface px-4 py-2.5">
      <div className="relative h-4 text-[11px] font-bold tabular-nums text-foreground">
        <span className="absolute -translate-x-1/2" style={{ left: pos(1) }}>
          100%
        </span>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border-strong/60" />
        <div
          className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-primary/80"
          style={{ left: pos(floor), width: `calc(${pos(ceiling)} - ${pos(floor)})` }}
        />
        <div className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: pos(1) }} />
      </div>
      <div className="relative h-4 text-[11px] font-bold tabular-nums text-muted">
        <span className={cn("absolute pr-0.5", floor > 0.6 && "-translate-x-full")} style={{ left: pos(floor) }}>
          {pct(floor)}
        </span>
        <span className={cn("absolute pl-0.5", ceiling > 1.4 && "-translate-x-full")} style={{ left: pos(ceiling) }}>
          {pct(ceiling)}
        </span>
      </div>
    </div>
  );
}

/** Kg (or L) per week for one commodity; saved on blur or Enter. */
function SupplyInput({ id, label, value, unit }: { id: string; label: string; value: number; unit: string }) {
  const { lang } = useT();
  const L = settingsStrings(lang);
  const [text, setText] = useState<string | null>(null);
  const n = text === null ? value : Number(text);
  const invalid = text !== null && (text.trim() === "" || !Number.isInteger(n) || n < 0);
  const commit = () => {
    if (text !== null && !invalid && n !== value) save({ marketSupplyKgPerWeek: { [id]: n } });
    setText(null);
  };
  return (
    <div className="grid gap-1">
      <div className="relative">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          value={text ?? String(value)}
          aria-label={`${label}, ${L.perWeekUnit(unit)}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={cn("pr-20 text-right tabular-nums", invalid && "border-danger ring-[3px] ring-danger/30")}
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
          {L.perWeekUnit(unit)}
        </span>
      </div>
      {invalid ? (
        <span role="alert" className="flex items-center gap-1 text-xs font-semibold text-danger-strong">
          <CircleAlert className="size-3.5" aria-hidden /> {L.supplyError}
        </span>
      ) : null}
    </div>
  );
}

export function ThresholdsTab() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const L = settingsStrings(lang);
  const S = t.settings;
  const s = d.data.settings;
  const sub = s.substitution;
  const eggs = d.ingredientsById.get("eggs");
  const eggBand = eggs ? d.commitmentBand("eggs") : null;
  const overdue = d.paymentRows.filter((r) => r.status.overdue).length;
  const supplyIds = Object.keys(s.marketSupplyKgPerWeek).filter((id) => d.ingredientsById.has(id));
  const live = useLiveMode();
  const user = useLiveUser();
  // Not signed in: the public sample values are shown read-only.
  const readOnly = !live || user?.role !== "admin";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h2 className="sr-only">{S.tabs.thresholds}</h2>
      <p className="flex items-start gap-2 rounded-2xl bg-primary-soft p-4 text-sm font-semibold text-primary-strong">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden /> {!live ? t.guest.settingsReadOnly : readOnly ? t.manage.adminOnly : S.thresholdsHint}
      </p>
      <fieldset disabled={readOnly} className="contents">

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <SectionCard icon={Tag} title={S.priceBand}>
          <SettingField
            id="set-floor"
            label={S.floor}
            unit="pct"
            min={50}
            max={100}
            value={s.priceBandFloorPct}
            defaultValue={D.priceBandFloorPct}
            onCommit={(v) => save({ priceBandFloorPct: v })}
          />
          <SettingField
            id="set-ceiling"
            label={S.ceiling}
            unit="pct"
            min={100}
            max={150}
            value={s.priceBandCeilingPct}
            defaultValue={D.priceBandCeilingPct}
            onCommit={(v) => save({ priceBandCeilingPct: v })}
          />
          <BandPreview floor={s.priceBandFloorPct} ceiling={s.priceBandCeilingPct} lang={lang} />
          {eggs && eggBand ? (
            <p className="text-sm text-muted">
              {L.bandExample(nm(eggs), formatRp(eggBand.floor, lang), formatRp(eggBand.ceiling, lang), formatRp(eggBand.ref, lang))}
            </p>
          ) : null}
        </SectionCard>

        <SectionCard icon={Shield} title={S.shield}>
          <SettingField
            id="set-shield-rise"
            label={S.shieldRise}
            unit="pct"
            min={1}
            max={50}
            value={s.shieldPriceRisePct}
            defaultValue={D.shieldPriceRisePct}
            onCommit={(v) => save({ shieldPriceRisePct: v })}
          />
          <SettingField
            id="set-shield-share"
            label={S.shieldDemand}
            unit="pct"
            min={5}
            max={100}
            value={s.shieldDemandSharePct}
            defaultValue={D.shieldDemandSharePct}
            onCommit={(v) => save({ shieldDemandSharePct: v })}
          />
          <details className="group rounded-xl border border-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {L.marketSupply}
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-2 border-t border-border p-3">
              <p className="text-xs text-muted">{L.marketSupplyHint}</p>
              <table className="w-full text-sm">
                <caption className="sr-only">{L.marketSupply}</caption>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="py-1 font-semibold">
                      {L.ingredient}
                    </th>
                    <th scope="col" className="py-1 text-right font-semibold">
                      {L.marketSupply}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {supplyIds.map((id) => {
                    const ing = d.ingredientsById.get(id)!;
                    return (
                      <tr key={id} className="border-t border-border">
                        <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
                          <IngredientLabel ingredient={ing} />
                        </th>
                        <td className="w-44 py-1.5">
                          <SupplyInput id={id} label={nm(ing)} value={s.marketSupplyKgPerWeek[id]} unit={ing.unit} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </SectionCard>

        <SectionCard icon={Users} title={S.matching}>
          <SettingField
            id="set-fairness"
            label={S.fairness}
            unit="pct"
            min={10}
            max={100}
            value={s.fairnessCapPct}
            defaultValue={D.fairnessCapPct}
            onCommit={(v) => save({ fairnessCapPct: v })}
          />
          <SettingField
            id="set-lead-weeks"
            label={L.leadWeeks}
            unit="weeks"
            min={1}
            max={4}
            value={s.commitmentLeadWeeks}
            defaultValue={D.commitmentLeadWeeks}
            onCommit={(v) => save({ commitmentLeadWeeks: v })}
          />
          <p className="rounded-xl bg-muted-surface p-3 text-sm text-muted">{t.kopdes.farmers.fairness(formatPct(s.fairnessCapPct, lang))}</p>
        </SectionCard>

        <SectionCard icon={TrendingUp} title={S.forecast}>
          <SettingField
            id="set-buffer"
            label={S.buffer}
            unit="pct"
            min={0}
            max={30}
            value={s.safetyBuffer}
            defaultValue={D.safetyBuffer}
            onCommit={(v) => save({ safetyBuffer: v })}
          />
          <SettingField
            id="set-attendance"
            label={S.attendance}
            unit="pct"
            min={50}
            max={100}
            value={s.attendanceRate}
            defaultValue={D.attendanceRate}
            onCommit={(v) => save({ attendanceRate: v })}
          />
        </SectionCard>

        <SectionCard icon={Wallet} title={S.payments} description={t.kopdes.payments.subtitle}>
          <SettingField
            id="set-sla"
            label={S.sla}
            unit="days"
            min={1}
            max={30}
            value={s.paymentSlaDays}
            defaultValue={D.paymentSlaDays}
            onCommit={(v) => save({ paymentSlaDays: v })}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted-surface p-3 text-sm">
            <span className="font-semibold text-muted">{t.kopdes.payments.title}</span>
            <StatusPill status={overdue > 0 ? "red" : "green"} label={overdue > 0 ? t.kopdes.payments.overdueCount(overdue) : t.status.onTime} size="sm" />
          </div>
        </SectionCard>
      </div>

      <SectionCard icon={ArrowLeftRight} title={S.substitution}>
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
          <SettingField
            id="set-min-protein"
            label={S.minProtein}
            unit="pct"
            min={50}
            max={100}
            value={sub.minProteinPct}
            defaultValue={D.substitution.minProteinPct}
            onCommit={(v) => saveSub({ minProteinPct: v })}
          />
          <SettingField
            id="set-energy-tol"
            label={S.energyTol}
            unit="pm"
            min={0}
            max={30}
            value={sub.energyTolerancePct}
            defaultValue={D.substitution.energyTolerancePct}
            onCommit={(v) => saveSub({ energyTolerancePct: v })}
          />
          <SettingField
            id="set-lead-days"
            label={S.leadDays}
            unit="days"
            min={0}
            max={14}
            value={sub.leadTimeDays}
            defaultValue={D.substitution.leadTimeDays}
            onCommit={(v) => saveSub({ leadTimeDays: v })}
          />
          <SettingField
            id="set-max-protein"
            label={S.maxProtein}
            unit="times"
            min={1}
            max={5}
            value={sub.maxMainProteinPerWeek}
            defaultValue={D.substitution.maxMainProteinPerWeek}
            onCommit={(v) => saveSub({ maxMainProteinPerWeek: v })}
          />
          <SettingField
            id="set-surplus"
            label={S.surplus}
            unit="pct"
            min={100}
            max={200}
            step={5}
            value={sub.surplusThreshold}
            defaultValue={D.substitution.surplusThreshold}
            onCommit={(v) => saveSub({ surplusThreshold: v })}
          />
          <SettingField
            id="set-topup"
            label={S.topUp}
            unit="g"
            min={0}
            max={100}
            step={5}
            value={sub.maxStapleTopUpG}
            defaultValue={D.substitution.maxStapleTopUpG}
            onCommit={(v) => saveSub({ maxStapleTopUpG: v })}
          />
        </div>
      </SectionCard>
      </fieldset>
      {/* Outside the fieldset: everyone may pick their language. */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <SectionCard icon={Languages} title={L.general}>
            <div className="grid gap-1.5">
              <Label htmlFor="set-lang">{S.language}</Label>
              <Select id="set-lang" value={lang} onChange={(e) => actions.setLang(e.target.value as Lang)} data-testid="settings-lang">
                <option value="en">{t.common.english}</option>
                <option value="id">{t.common.indonesian}</option>
              </Select>
            </div>
          </SectionCard>
      </div>
    </div>
  );
}
