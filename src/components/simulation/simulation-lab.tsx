"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FlaskConical, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { ChartCard } from "@/components/common/chart-card";
import { FactLine } from "@/components/common/fact-source";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { getFact } from "@/content/facts";
import { seedSimulationInput } from "@/data/simulation-input";
import { formatNumber, formatPct, formatRp, formatRpCompact } from "@/engines/format";
import { DEFAULT_SIM_PARAMS, runSimulation, SIM_ASSUMPTIONS, SIM_WEEKS, type SimulationParams, type StrategyMetrics } from "@/engines/simulation";
import { useT } from "@/i18n";
import { CHART_AXIS_TEXT, CHART_GRID, STRATEGY_COLORS, legendText } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";

const INPUT = seedSimulationInput();

type MetricKey = "localShare" | "unmet" | "cost" | "exposure" | "income" | "farmers" | "compliance";

export function SimulationLab() {
  const { t, lang, nm } = useT();
  const [params, setParams] = useState<SimulationParams>(DEFAULT_SIM_PARAMS);
  const result = useMemo(() => runSimulation(INPUT, params), [params]);
  const S = t.simulation;
  const b = result.baseline.metrics;
  const p = result.piringtani.metrics;

  const metric = (key: MetricKey, m: StrategyMetrics) => {
    switch (key) {
      case "localShare":
        return formatPct(m.localShare, lang, 1);
      case "unmet":
        return formatPct(m.unmetPct, lang, 2);
      case "cost":
        return formatRp(m.costPerPortion, lang);
      case "exposure":
        return formatRpCompact(m.priceExposureRp, lang);
      case "income":
        return formatRpCompact(m.farmerIncomeRp, lang);
      case "farmers":
        return formatNumber(m.farmersEngaged, lang);
      case "compliance":
        return formatPct(m.compliance, lang, 1);
    }
  };
  const better: Record<MetricKey, (a: StrategyMetrics, c: StrategyMetrics) => boolean> = {
    localShare: (a, c) => c.localShare > a.localShare,
    unmet: (a, c) => c.unmetPct < a.unmetPct,
    cost: (a, c) => c.costPerPortion < a.costPerPortion,
    exposure: (a, c) => c.priceExposureRp < a.priceExposureRp,
    income: (a, c) => c.farmerIncomeRp > a.farmerIncomeRp,
    farmers: (a, c) => c.farmersEngaged > a.farmersEngaged,
    compliance: (a, c) => c.compliance > a.compliance,
  };
  const diff = (key: MetricKey) => {
    switch (key) {
      case "localShare":
        return `${p.localShare - b.localShare >= 0 ? "+" : ""}${formatNumber((p.localShare - b.localShare) * 100, lang, 1)} pp`;
      case "unmet":
        return `${formatNumber((p.unmetPct - b.unmetPct) * 100, lang, 2)} pp`;
      case "cost":
        return `${p.costPerPortion - b.costPerPortion >= 0 ? "+" : "−"}${formatRp(Math.abs(p.costPerPortion - b.costPerPortion), lang)}`;
      case "exposure":
        return `${p.priceExposureRp - b.priceExposureRp >= 0 ? "+" : "−"}${formatRpCompact(Math.abs(p.priceExposureRp - b.priceExposureRp), lang)}`;
      case "income":
        return `${b.farmerIncomeRp > 0 ? "×" + formatNumber(p.farmerIncomeRp / b.farmerIncomeRp, lang, 1) : ""}`;
      case "farmers":
        return `${p.farmersEngaged - b.farmersEngaged >= 0 ? "+" : ""}${p.farmersEngaged - b.farmersEngaged}`;
      case "compliance":
        return `${p.compliance - b.compliance >= 0 ? "+" : ""}${formatNumber((p.compliance - b.compliance) * 100, lang, 1)} pp`;
    }
  };
  const keys: MetricKey[] = ["localShare", "unmet", "cost", "exposure", "income", "farmers", "compliance"];
  const label: Record<MetricKey, string> = {
    localShare: S.metrics.localShare,
    unmet: S.metrics.unmet,
    cost: S.metrics.cost,
    exposure: S.metrics.exposure,
    income: S.metrics.income,
    farmers: S.metrics.farmers,
    compliance: S.metrics.compliance,
  };
  const sub = (key: MetricKey, m: StrategyMetrics) =>
    key === "cost" ? S.budgetLine(formatRp(m.budgetPerPortion, lang)) : key === "farmers" ? S.womenYouth(formatPct(m.womenShare, lang), formatPct(m.youthShare, lang)) : "";

  const weekly = SIM_WEEKS.map((w, i) => ({
    week: t.kitchen.home.weekLabel(w),
    bLocal: Math.round(result.baseline.weekly[i].localShare * 1000) / 10,
    pLocal: Math.round(result.piringtani.weekly[i].localShare * 1000) / 10,
    bCost: Math.round(result.baseline.weekly[i].costPerPortion),
    pCost: Math.round(result.piringtani.weekly[i].costPerPortion),
    bExp: Math.round(result.baseline.weekly[i].exposureCum),
    pExp: Math.round(result.piringtani.weekly[i].exposureCum),
    bUnmet: Math.round(result.baseline.weekly[i].unmetPct * 10000) / 100,
    pUnmet: Math.round(result.piringtani.weekly[i].unmetPct * 10000) / 100,
  }));

  const weeklyTable = (fields: [string, string], fmt: (v: number) => string) => (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="py-1">{t.common.week}</th>
          <th className="py-1 text-right">{S.baseline}</th>
          <th className="py-1 text-right">{S.piringtani}</th>
        </tr>
      </thead>
      <tbody>
        {weekly.map((r) => (
          <tr key={r.week} className="border-t border-border">
            <td className="py-1.5">{r.week}</td>
            <td className="py-1.5 text-right tabular-nums">{fmt(r[fields[0] as keyof typeof r] as number)}</td>
            <td className="py-1.5 text-right tabular-nums">{fmt(r[fields[1] as keyof typeof r] as number)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const two = (bKey: string, pKey: string, fmt: (v: number) => string, extra?: React.ReactNode, kind: "line" | "bar" = "line", domain?: [number, number]) => (
    <div className="h-60" role="img">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis dataKey="week" tickLine={false} axisLine={{ stroke: CHART_GRID }} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} tickFormatter={fmt} />
            <Tooltip formatter={(v, n) => [fmt(Number(v)), String(n)]} contentStyle={{ borderRadius: 12, borderColor: CHART_GRID }} />
            <Legend iconType="circle" itemSorter={null} formatter={legendText} />
            <Bar dataKey={bKey} name={S.baseline} fill={STRATEGY_COLORS.baseline} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey={pKey} name={S.piringtani} fill={STRATEGY_COLORS.piringtani} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        ) : (
          <LineChart data={weekly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis dataKey="week" tickLine={false} axisLine={{ stroke: CHART_GRID }} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} tickFormatter={fmt} domain={domain ?? ["auto", "auto"]} />
            <Tooltip formatter={(v, n) => [fmt(Number(v)), String(n)]} contentStyle={{ borderRadius: 12, borderColor: CHART_GRID }} />
            <Legend iconType="plainline" itemSorter={null} formatter={legendText} />
            {extra}
            <Line isAnimationActive={false} type="linear" dataKey={bKey} name={S.baseline} stroke={STRATEGY_COLORS.baseline} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#ffffff", fill: STRATEGY_COLORS.baseline }} />
            <Line isAnimationActive={false} type="linear" dataKey={pKey} name={S.piringtani} stroke={STRATEGY_COLORS.piringtani} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#ffffff", fill: STRATEGY_COLORS.piringtani }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );

  const set = (patch: Partial<SimulationParams>) => setParams((x) => ({ ...x, ...patch }));
  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);
  const isDefault = JSON.stringify(params) === JSON.stringify(DEFAULT_SIM_PARAMS);

  const assumptions: [string, string][] = [
    [S.seed, String(params.seed)],
    [S.baselineShare, formatPct(params.baselineKopdesShare, lang)],
    [`${S.shockChicken}`, `${t.common.weekN(params.chicken.week)}: ${formatRp(params.chicken.from, lang)} → ${formatRp(params.chicken.to, lang)}/kg`],
    [`${S.shockEggs}`, `${t.common.weekN(params.eggs.week)}: −${formatPct(params.eggs.shortfall, lang)}`],
    [`${S.shockVeg}`, `${t.common.weekN(params.veg.week)}: ${params.veg.ingredientId === "kangkung" ? "kangkung" : lang === "id" ? "bayam" : "spinach"} +${formatPct(params.veg.surplus, lang)}`],
    [lang === "id" ? "Wilayah demo" : "Demo region", lang === "id" ? "3 dapur (±3.000 anak), 2 Kopdes, 18 petani (fiktif)" : "3 kitchens (~3,000 children each), 2 Kopdes, 18 farmers (fictional)"],
    [lang === "id" ? "Kehadiran" : "Attendance", `${formatPct(0.92, lang)} ± ${formatPct(SIM_ASSUMPTIONS.attendanceSd, lang, 1)} (${lang === "id" ? "acak per minggu" : "random per week"})`],
    [lang === "id" ? "Harga normal" : "Normal prices", lang === "id" ? `Rata-rata 4 minggu placeholder, ± ${formatPct(SIM_ASSUMPTIONS.priceNoiseSd, lang)} per minggu` : `4-week placeholder average, ± ${formatPct(SIM_ASSUMPTIONS.priceNoiseSd, lang)} per week`],
    [lang === "id" ? "Harga saat telur kurang" : "Eggs price in the shortfall", `+${formatPct(SIM_ASSUMPTIONS.shortagePriceRise, lang)}`],
    [lang === "id" ? "Harga saat panen melimpah" : "Vegetable price in the surplus", `−${formatPct(SIM_ASSUMPTIONS.surplusPriceDrop, lang)}`],
    [lang === "id" ? "Pita harga" : "Price band", `${formatPct(SIM_ASSUMPTIONS.bandFloorPct, lang)}–${formatPct(SIM_ASSUMPTIONS.bandCeilingPct, lang)} ${lang === "id" ? "dari harga normal" : "of the normal price"}`],
    [lang === "id" ? "Margin Kopdes" : "Kopdes margin", formatPct(SIM_ASSUMPTIONS.kopdesMargin, lang)],
    [lang === "id" ? "Batas keadilan" : "Fairness cap", formatPct(SIM_ASSUMPTIONS.fairnessCapPct, lang)],
    [lang === "id" ? "Pengiriman petani" : "Farmer deliveries", lang === "id" ? `Penuh dengan peluang = keandalan, jika tidak ${formatPct(SIM_ASSUMPTIONS.partialDeliveryFactor, lang)}` : `Full with probability = reliability, else ${formatPct(SIM_ASSUMPTIONS.partialDeliveryFactor, lang)}`],
    [lang === "id" ? "Pesanan PiringTani" : "PiringTani orders", lang === "id" ? "Porsi pesanan tiap dapur ke Kopdes × prakiraan + cadangan 5%" : "Each kitchen's Kopdes order share × forecast + 5% buffer"],
    ["Price Shield", lang === "id" ? `Jika harga > rata-rata +10%, ${formatPct(SIM_ASSUMPTIONS.spreadShare, lang)} pembelian pasar dimajukan seminggu` : `If price > average +10%, ${formatPct(SIM_ASSUMPTIONS.spreadShare, lang)} of spot buying moves one week earlier`],
    [lang === "id" ? "Tukar Menu" : "Menu Switch", lang === "id" ? "Mesin substitusi yang sama dengan aplikasi, maks. 1 hari per dapur per guncangan, aturan gizi dan anggaran dipatuhi" : "Same substitution engine as the app, max 1 day per kitchen per shock, all nutrition and budget rules applied"],
    [lang === "id" ? "Pendapatan petani" : "Farmer income", lang === "id" ? "Petani anggota Kopdes Sumbangsari, setelah margin Kopdes" : "Members of Kopdes Sumbangsari, after the Kopdes margin"],
    [lang === "id" ? "Kepatuhan gizi" : "Nutrition compliance", lang === "id" ? "Porsi yang lauk hewaninya tidak terpenuhi dihitung tidak patuh" : "Portions whose main protein went unmet count as non-compliant"],
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" aria-hidden /> {t.common.simulationLab}
          </span>
        }
        title={S.title}
        subtitle={S.subtitle}
        actions={
          <Button variant="outline" onClick={() => setParams(DEFAULT_SIM_PARAMS)} disabled={isDefault}>
            <RotateCcw aria-hidden /> {S.reset}
          </Button>
        }
      />
      <div role="note" className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-accent bg-accent-soft p-4 text-lg font-bold text-accent-strong" data-testid="sim-banner">
        <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden /> {S.banner}
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{S.shocksTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-bold">{S.shockChicken}</legend>
                <div className="grid grid-cols-[4rem_1fr_1fr] gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="sim-cw" className="text-xs">{S.shockChickenWeek}</Label>
                    <Input id="sim-cw" type="number" min={1} max={8} value={params.chicken.week} onChange={(e) => set({ chicken: { ...params.chicken, week: Math.min(8, Math.max(1, num(e.target.value, 3))) } })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="sim-cf" className="text-xs">{S.shockChickenFrom}</Label>
                    <Input id="sim-cf" type="number" step={500} value={params.chicken.from} onChange={(e) => set({ chicken: { ...params.chicken, from: num(e.target.value, 35000) } })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="sim-ct" className="text-xs">{S.shockChickenTo}</Label>
                    <Input id="sim-ct" type="number" step={500} value={params.chicken.to} onChange={(e) => set({ chicken: { ...params.chicken, to: num(e.target.value, 42000) } })} />
                  </div>
                </div>
                <FactLine fact={getFact("chicken-pasar-wage")} className="text-xs" />
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-bold">{S.shockEggs}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="sim-ew" className="text-xs">{S.shockChickenWeek}</Label>
                    <Input id="sim-ew" type="number" min={1} max={8} value={params.eggs.week} onChange={(e) => set({ eggs: { ...params.eggs, week: Math.min(8, Math.max(1, num(e.target.value, 5))) } })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="sim-es" className="text-xs">{S.shockShare} (%)</Label>
                    <Input id="sim-es" type="number" min={0} max={90} step={5} value={Math.round(params.eggs.shortfall * 100)} onChange={(e) => set({ eggs: { ...params.eggs, shortfall: Math.min(0.9, Math.max(0, num(e.target.value, 25) / 100)) } })} />
                  </div>
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-bold">{S.shockVeg}</legend>
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="sim-vw" className="text-xs">{S.shockChickenWeek}</Label>
                    <Input id="sim-vw" type="number" min={1} max={8} value={params.veg.week} onChange={(e) => set({ veg: { ...params.veg, week: Math.min(8, Math.max(1, num(e.target.value, 6))) } })} />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="sim-vi" className="text-xs">{t.kopdes.delivery.ingredient}</Label>
                    <Select id="sim-vi" value={params.veg.ingredientId} onChange={(e) => set({ veg: { ...params.veg, ingredientId: e.target.value as "spinach" | "kangkung" } })}>
                      <option value="kangkung">{nm(INPUT.ingredients.find((i) => i.id === "kangkung"))}</option>
                      <option value="spinach">{nm(INPUT.ingredients.find((i) => i.id === "spinach"))}</option>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="sim-vs" className="text-xs">{S.shockShare} (%)</Label>
                  <Input id="sim-vs" type="number" min={0} max={200} step={5} value={Math.round(params.veg.surplus * 100)} onChange={(e) => set({ veg: { ...params.veg, surplus: Math.min(2, Math.max(0, num(e.target.value, 40) / 100)) } })} />
                </div>
              </fieldset>
              <div className="grid gap-1">
                <Label htmlFor="sim-bs" className="text-sm font-bold">{S.baselineShare} (%)</Label>
                <Input id="sim-bs" type="number" min={0} max={100} step={5} value={Math.round(params.baselineKopdesShare * 100)} onChange={(e) => set({ baselineKopdesShare: Math.min(1, Math.max(0, num(e.target.value, 15) / 100)) })} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="sim-seed" className="text-sm font-bold">{S.seed}</Label>
                <Input id="sim-seed" type="number" value={params.seed} onChange={(e) => set({ seed: Math.round(num(e.target.value, 2026)) })} data-testid="sim-seed" />
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="grid min-w-0 content-start gap-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border-2 p-4" style={{ borderColor: STRATEGY_COLORS.baseline }}>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className="size-3 rounded-full" style={{ background: STRATEGY_COLORS.baseline }} aria-hidden /> {S.baseline}
              </h2>
              <p className="text-sm text-muted">{S.baselineDesc.replace("15%", formatPct(params.baselineKopdesShare, lang))}</p>
            </div>
            <div className="rounded-2xl border-2 p-4" style={{ borderColor: STRATEGY_COLORS.piringtani }}>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className="size-3 rounded-full" style={{ background: STRATEGY_COLORS.piringtani }} aria-hidden /> {S.piringtani}
              </h2>
              <p className="text-sm text-muted">{S.piringtaniDesc}</p>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" aria-label={S.resultsTable}>
            {keys.map((key) => {
              const good = better[key](b, p);
              return (
                <li key={key} className="grid gap-2 rounded-2xl border border-border bg-surface p-4 shadow-soft" data-testid={`sim-metric-${key}`}>
                  <div className="text-sm font-semibold text-muted">{label[key]}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: STRATEGY_COLORS.baseline }}>
                        <span className="sr-only">{S.baseline}: </span>
                        <span aria-hidden>●</span> Baseline
                      </div>
                      <div className="whitespace-nowrap text-xl font-bold tabular-nums">{metric(key, b)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-ok-strong">
                        <span aria-hidden style={{ color: STRATEGY_COLORS.piringtani }}>●</span> PiringTani
                      </div>
                      <div className="whitespace-nowrap text-xl font-extrabold tabular-nums text-primary-strong">{metric(key, p)}</div>
                    </div>
                  </div>
                  <div className={cn("text-xs font-semibold", good ? "text-ok-strong" : "text-muted")}>
                    {diff(key)} {good ? `· ${S.better}` : ""}
                  </div>
                  {sub(key, p) ? <div className="text-xs text-muted">{key === "farmers" ? `${S.piringtani}: ${sub(key, p)}` : sub(key, p)}</div> : null}
                </li>
              );
            })}
          </ul>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard title={S.chartLocal} fileName="piringtani-sim-local-share" table={weeklyTable(["bLocal", "pLocal"], (v) => `${formatNumber(v, lang, 1)}%`)} tour="sim-chart">
              {two("bLocal", "pLocal", (v) => `${formatNumber(v, lang, 0)}%`, undefined, "bar")}
            </ChartCard>
            <ChartCard title={S.chartCost} fileName="piringtani-sim-cost" table={weeklyTable(["bCost", "pCost"], (v) => formatRp(v, lang))}>
              {two(
                "bCost",
                "pCost",
                (v) => formatNumber(v, lang),
                <ReferenceLine y={Math.round(b.budgetPerPortion)} stroke="#c8412d" strokeDasharray="4 4" label={{ value: S.budgetLine(formatRp(b.budgetPerPortion, lang)), fill: CHART_AXIS_TEXT, fontSize: 11, position: "insideBottomRight" }} />,
                "line",
                [Math.floor((Math.min(...weekly.flatMap((w) => [w.bCost, w.pCost])) * 0.9) / 500) * 500, Math.ceil((b.budgetPerPortion * 1.04) / 500) * 500],
              )}
            </ChartCard>
            <ChartCard title={S.chartExposure} fileName="piringtani-sim-exposure" table={weeklyTable(["bExp", "pExp"], (v) => formatRp(v, lang))}>
              {two("bExp", "pExp", (v) => formatRpCompact(v, lang))}
            </ChartCard>
            <ChartCard title={S.chartUnmet} fileName="piringtani-sim-unmet" table={weeklyTable(["bUnmet", "pUnmet"], (v) => `${formatNumber(v, lang, 2)}%`)}>
              {two("bUnmet", "pUnmet", (v) => `${formatNumber(v, lang, 1)}%`, undefined, "bar")}
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{S.resultsTable}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm" data-testid="sim-results-table">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="py-2">{S.metric}</th>
                    <th className="py-2 text-right">{S.baseline}</th>
                    <th className="py-2 text-right">{S.piringtani}</th>
                    <th className="py-2 text-right">{S.difference}</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key} className="border-b border-border last:border-0">
                      <td className="py-2 font-semibold">{label[key]}</td>
                      <td className="py-2 text-right tabular-nums">
                        {metric(key, b)}
                        {sub(key, b) && key === "farmers" ? <div className="text-xs text-muted">{sub(key, b)}</div> : null}
                      </td>
                      <td className="py-2 text-right font-bold tabular-nums">
                        {metric(key, p)}
                        {sub(key, p) && key === "farmers" ? <div className="text-xs font-normal text-muted">{sub(key, p)}</div> : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">{diff(key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card data-testid="sim-assumptions">
            <CardHeader>
              <CardTitle>{S.assumptions}</CardTitle>
              <p className="text-sm text-muted">{S.assumptionsHint}</p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {assumptions.map(([k, v]) => (
                  <div key={k} className="border-b border-border pb-2">
                    <dt className="text-xs font-semibold text-muted">{k}</dt>
                    <dd className="text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
              <FactLine fact={getFact("raw-food-budget")} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
