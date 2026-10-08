"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/common/chart-card";
import { IngredientLabel } from "@/components/common/ingredient";
import { cellOf } from "@/engines/forecast";
import { formatDate, formatNumber, formatPct } from "@/engines/format";
import { PLANNING_WEEKS } from "@/engines/derive";
import { weekStart } from "@/engines/time";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { CATEGORICAL, CHART_AXIS_TEXT, CHART_GRID, CHART_SURFACE, OTHER_COLOR, legendText } from "@/lib/chart-colors";
import { KitchenShell } from "./kitchen-shell";

const TOP_N = 6;

export function ForecastView() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const [all, setAll] = useState(false);
  const kitchenId = d.data.ui.activeKitchenId;
  const k = d.kitchensById.get(kitchenId)!;
  const table = d.kitchenTables.get(kitchenId)!;
  const mape = d.mapeByKitchen.get(kitchenId);

  const ranked = useMemo(
    () =>
      d.data.ingredients
        .map((ing) => ({ ing, total: PLANNING_WEEKS.reduce((s, w) => s + cellOf(table, ing.id, w).kgExpected, 0) }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total),
    [d, table],
  );
  const top = ranked.slice(0, TOP_N);
  const rest = ranked.slice(TOP_N);
  const otherLabel = lang === "id" ? "Lainnya" : "Other";
  const chartData = PLANNING_WEEKS.map((w) => {
    const row: Record<string, number | string> = { week: t.kitchen.home.weekLabel(w) };
    for (const x of top) row[x.ing.id] = Math.round(cellOf(table, x.ing.id, w).kgExpected);
    row.other = Math.round(rest.reduce((s, x) => s + cellOf(table, x.ing.id, w).kgExpected, 0));
    return row;
  });
  const holidays = PLANNING_WEEKS.filter((w) =>
    k.schoolCalendar.holidays.some((h) => h.date >= weekStart(d.today, w) && h.date < weekStart(d.today, w + 1)),
  );
  const rows = all ? ranked : top;

  const forecastTable = (
    <table className="w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="py-2 pr-2 font-semibold">{t.kitchen.forecast.ingredient}</th>
          {PLANNING_WEEKS.map((w) => (
            <th key={w} className="px-1 py-2 text-right font-semibold">
              {t.kitchen.home.weekLabel(w)}
              {holidays.includes(w) ? " *" : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ ing }) => (
          <tr key={ing.id} className="border-b border-border last:border-0">
            <td className="py-2 pr-2 font-semibold">
              <IngredientLabel ingredient={ing} />
              <span className="ml-1 text-xs font-normal text-muted">({ing.unit})</span>
            </td>
            {PLANNING_WEEKS.map((w) => {
              const c = cellOf(table, ing.id, w);
              return (
                <td key={w} className="px-1 py-2 text-right tabular-nums">
                  <div className="font-semibold">{formatNumber(c.kgExpected, lang)}</div>
                  <div className="text-[11px] text-muted">
                    {formatNumber(c.kgLow, lang)}–{formatNumber(c.kgHigh, lang)}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <KitchenShell
      title={t.kitchen.forecast.title}
      subtitle={t.kitchen.forecast.subtitle}
      actions={
        <Badge variant={mape !== null && mape !== undefined && mape < 0.1 ? "green" : "yellow"} className="min-h-11 px-3 text-base" data-testid="mape-badge" title={t.kitchen.forecast.mapeHint}>
          <Gauge aria-hidden /> {t.kitchen.forecast.mape}: {mape === null || mape === undefined ? "–" : t.kitchen.forecast.mapeValue(formatPct(mape, lang, 1))}
        </Badge>
      }
    >
      <div className="grid gap-5">
        <ChartCard
          title={t.kitchen.forecast.chartTitle}
          description={`${t.kitchen.forecast.chartHint} ${formatDate(weekStart(d.today, 1), lang)} – ${formatDate(weekStart(d.today, 8), lang)}.`}
          fileName="piringtani-forecast"
          tour="forecast-chart"
          table={forecastTable}
        >
          <div className="h-80 w-full" role="img" aria-label={t.kitchen.forecast.chartTitle}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="week" tickLine={false} axisLine={{ stroke: CHART_GRID }} tick={{ fill: CHART_AXIS_TEXT, fontSize: 13 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
                  tickFormatter={(v: number) => formatNumber(v, lang)}
                />
                <Tooltip
                  cursor={{ fill: "rgba(31,111,74,0.06)" }}
                  formatter={(v, name) => [`${formatNumber(Number(v), lang)} kg`, String(name)]}
                  contentStyle={{ borderRadius: 12, borderColor: CHART_GRID }}
                />
                <Legend iconType="circle" itemSorter={null} formatter={legendText} />
                {top.map((x, i) => (
                  <Bar key={x.ing.id} dataKey={x.ing.id} name={nm(x.ing)} stackId="a" fill={CATEGORICAL[i]} stroke={CHART_SURFACE} strokeWidth={2} maxBarSize={28} />
                ))}
                <Bar dataKey="other" name={otherLabel} stackId="a" fill={OTHER_COLOR} stroke={CHART_SURFACE} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {holidays.length ? <p className="mt-2 text-sm text-muted">* {t.kitchen.forecast.holidayWeek}: {holidays.map((w) => t.common.weekN(w)).join(", ")}</p> : null}
        </ChartCard>

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5" aria-labelledby="forecast-table">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="forecast-table" className="text-lg font-bold">
              {t.kitchen.forecast.tableTitle}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)} aria-pressed={all}>
              {all ? t.kitchen.forecast.topN : t.kitchen.forecast.allIngredients}
            </Button>
          </div>
          <div className="overflow-x-auto">{forecastTable}</div>
          <p className="mt-3 text-sm text-muted">{t.kitchen.forecast.unitNote}</p>
          <p className="text-sm text-muted">{t.kitchen.forecast.formula}</p>
        </section>
      </div>
    </KitchenShell>
  );
}
