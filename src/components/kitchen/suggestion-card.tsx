"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Shuffle, X } from "lucide-react";
import type { SubstitutionOption, SubstitutionSuggestion } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IngredientLabel } from "@/components/common/ingredient";
import { WhyLine } from "@/components/common/why";
import { useToast } from "@/components/common/toast";
import { formatDate, formatNumber, formatRp } from "@/engines/format";
import { BUDGET_RP } from "@/engines/substitution";
import { useT } from "@/i18n";
import { actions, useDerived } from "@/lib/repo";
import { cn } from "@/lib/utils";

function pct(v: number) {
  return Math.round(v * 100);
}

function CheckRow({ label, value, rule, ok, compact }: { label: string; value: React.ReactNode; rule: string; ok: boolean; compact?: boolean }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {compact ? null : <div className="text-xs text-muted">{rule}</div>}
      </div>
      <div className="flex items-center gap-2 text-right">
        <span className="text-base font-bold tabular-nums">{value}</span>
        <span
          className={cn("flex size-6 items-center justify-center rounded-full", ok ? "bg-ok-soft text-ok-strong" : "bg-danger-soft text-danger-strong")}
          role="img"
          aria-label={ok ? t.common.checkPass : t.common.checkFail}
        >
          {ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
        </span>
      </div>
    </div>
  );
}

export function NutritionCheck({ option, compact }: { option: SubstitutionOption; compact?: boolean }) {
  const { t, lang } = useT();
  const L = t.kitchen.switch;
  const n = option.nutritionCheck;
  const tol = 0.1;
  return (
    <div className={cn("rounded-xl border border-border bg-surface px-3", compact ? "py-1" : "py-2")} data-testid="nutrition-check">
      {!compact ? <div className="pt-1 text-xs font-bold uppercase tracking-wide text-muted">{L.nutritionCheck}</div> : null}
      <CheckRow label={L.protein} value={`${pct(n.proteinPct)}%`} rule={L.ruleProtein} ok={n.proteinPct >= 0.95 - 1e-9} compact={compact} />
      <CheckRow label={L.energy} value={`${pct(n.energyPct)}%`} rule={L.ruleEnergy} ok={Math.abs(n.energyPct - 1) <= tol + 1e-9} compact={compact} />
      <CheckRow
        label={L.cost}
        value={
          <span className="whitespace-nowrap">
            {formatRp(option.costPerPortionBefore.large, lang)} → {formatRp(option.costPerPortionAfter.large, lang)}
          </span>
        }
        rule={L.ruleBudget}
        compact={compact}
        ok={option.costPerPortionAfter.large <= BUDGET_RP.large && option.costPerPortionAfter.small <= BUDGET_RP.small}
      />
      {!compact ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border py-2 text-xs font-semibold text-ok-strong">
          <span className="inline-flex items-center gap-1">
            <Check className="size-3.5" aria-hidden /> {L.ruleDiversity}
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="size-3.5" aria-hidden /> {L.ruleLead}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SwapLine({ s, option }: { s: SubstitutionSuggestion; option: SubstitutionOption }) {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const from = d.ingredientsById.get(s.fromIngredientId);
  const to = d.ingredientsById.get(option.toIngredientId);
  const staple = option.stapleIngredientId ? d.ingredientsById.get(option.stapleIngredientId) : undefined;
  const topUp = option.stapleTopUpG.large;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold">
      <IngredientLabel ingredient={from} />
      <span className="text-sm font-semibold text-muted">{s.fromGrams.large} g</span>
      <ArrowRight className="size-5 text-accent-strong" aria-label="→" />
      <IngredientLabel ingredient={to} />
      <span className="text-sm font-semibold text-muted">{option.gramsNew.large} g</span>
      {staple && topUp !== 0 ? (
        <Badge variant="muted" className="text-xs">
          {nm(staple)} {topUp > 0 ? "+" : ""}
          {formatNumber(topUp, lang)} g
        </Badge>
      ) : null}
      <span className="sr-only">{t.common.portionLarge}</span>
    </div>
  );
}

function ScoreBars({ option }: { option: SubstitutionOption }) {
  const { t } = useT();
  const parts = t.kitchen.switch.scoreParts;
  const rows: [string, number, number][] = [
    [parts.local, option.scores.local, 35],
    [parts.cost, option.scores.cost, 25],
    [parts.nutrition, option.scores.nutrition, 25],
    [parts.acceptance, option.scores.acceptance, 15],
  ];
  return (
    <div className="grid gap-1.5">
      {rows.map(([label, v, w]) => (
        <div key={label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 text-sm">
          <span className="text-muted">
            {label} <span className="text-xs">({w}%)</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-muted-surface">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(v * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums">{Math.round(v * 100)}</span>
        </div>
      ))}
    </div>
  );
}

function SizeTable({ option }: { option: SubstitutionOption }) {
  const { t, lang } = useT();
  const L = t.kitchen.switch;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="py-1 font-semibold"> </th>
          <th className="py-1 font-semibold">{L.protein}</th>
          <th className="py-1 font-semibold">{L.energy}</th>
          <th className="py-1 font-semibold">{L.cost}</th>
        </tr>
      </thead>
      <tbody>
        {(["small", "large"] as const).map((size) => (
          <tr key={size} className="border-t border-border">
            <td className="py-1.5 font-semibold">{size === "small" ? t.common.small : t.common.large}</td>
            <td className="py-1.5 tabular-nums">
              {pct(option.nutritionCheck.bySize[size].proteinPct)}% · {formatNumber(option.nutritionCheck.bySize[size].proteinG, lang, 1)} g
            </td>
            <td className="py-1.5 tabular-nums">
              {pct(option.nutritionCheck.bySize[size].energyPct)}% · {formatNumber(option.nutritionCheck.bySize[size].energyKcal, lang)} kcal
            </td>
            <td className="py-1.5 tabular-nums">
              {formatRp(option.costPerPortionBefore[size], lang)} → {formatRp(option.costPerPortionAfter[size], lang)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SuggestionCard({ s, compact = false, tour }: { s: SubstitutionSuggestion; compact?: boolean; tour?: string }) {
  const { t, lang, lt } = useT();
  const notify = useToast();
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const L = t.kitchen.switch;

  const approve = (index = -1) => {
    actions.approveSuggestion(s, index);
    notify(L.approvedToast);
  };
  const reject = () => {
    actions.rejectSuggestion(s);
    notify(L.rejectedToast, "info");
  };

  return (
    <article
      className={cn("flex flex-col gap-3 rounded-2xl border-2 border-accent/60 bg-surface p-4 shadow-soft sm:p-5", compact && "border")}
      data-testid="suggestion-card"
      data-suggestion={`${s.fromIngredientId}->${s.toIngredientId}`}
      data-tour={tour}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">
          <Shuffle aria-hidden /> {L.reasons[s.reason]}
        </Badge>
        <span className="text-sm font-semibold text-muted">
          {formatDate(s.date, lang, { weekday: true })} · {t.common.weekN(s.week)}
        </span>
        <Badge variant="outline" className="ml-auto">
          {L.score} {s.scores.total}
        </Badge>
      </div>
      <SwapLine s={s} option={s} />
      <WhyLine>{lt(s.why)}</WhyLine>
      {!compact ? <p className="text-sm text-muted">{lt(s.explanation)}</p> : null}
      <NutritionCheck option={s} compact={compact} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => approve()} data-testid="approve-suggestion">
          <Check aria-hidden /> {t.common.approve}
        </Button>
        {!compact ? (
          <Button variant="outline" onClick={reject} data-testid="reject-suggestion">
            <X aria-hidden /> {t.common.reject}
          </Button>
        ) : null}
        {s.alternatives.length > 0 ? (
          <Button variant="ghost" onClick={() => setShowAlternatives((v) => !v)} aria-expanded={showAlternatives}>
            {showAlternatives ? t.common.hideOtherOptions : t.common.seeOtherOptions}
            <ChevronDown className={cn("transition-transform", showAlternatives && "rotate-180")} aria-hidden />
          </Button>
        ) : null}
        {!compact ? (
          <Button variant="link" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails} className="ml-auto">
            {showDetails ? t.common.hideDetails : t.common.seeDetails}
          </Button>
        ) : null}
      </div>
      {showAlternatives ? (
        <div className="grid gap-3 border-t border-border pt-3">
          <h4 className="text-sm font-bold uppercase tracking-wide text-muted">{L.alternatives}</h4>
          {s.alternatives.map((o, i) => (
            <div key={o.toIngredientId} className="grid gap-2 rounded-xl bg-muted-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SwapLine s={s} option={o} />
                <Badge variant="outline">
                  {L.score} {o.scores.total}
                </Badge>
              </div>
              <p className="text-sm text-muted">{lt(o.explanation)}</p>
              <NutritionCheck option={o} compact />
              <div>
                <Button variant="secondary" size="sm" onClick={() => approve(i)}>
                  {L.approveOption}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {showDetails ? (
        <div className="grid gap-4 border-t border-border pt-3 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-bold">{L.score}</h4>
            <ScoreBars option={s} />
          </div>
          <div>
            <h4 className="mb-1 text-sm font-bold">{L.nutritionCheck}</h4>
            <SizeTable option={s} />
            <p className="mt-2 text-xs text-muted">{L.measuredOn}</p>
            <p className="mt-1 text-xs text-muted">{L.availableFrom(s.localFarmers)}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
