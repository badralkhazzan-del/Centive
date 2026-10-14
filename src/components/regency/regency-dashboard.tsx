"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChefHat, Gauge, HandCoins, List, Map as MapIcon, Printer, ShieldAlert, Store, Timer, Users, Utensils, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard } from "@/components/common/chart-card";
import { HydrationGate } from "@/components/common/gate";
import { StatusPill } from "@/components/common/status";
import { Sparkline } from "@/components/common/sparkline";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { coverageStatus } from "@/engines/matching";
import { formatDate, formatNumber, formatPct, formatRpCompact } from "@/engines/format";
import { linkCoverage, regencyKpis, type RegencyKpis } from "@/engines/kpis";
import { priceForWeek } from "@/engines/priceBand";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { shortKopdesName } from "@/lib/names";
import { CATEGORICAL, CHART_AXIS_TEXT, CHART_GRID, STRATEGY_COLORS, legendText } from "@/lib/chart-colors";
import type { MapLink, MapNode } from "./map-inner";

const RegencyMapInner = dynamic(() => import("./map-inner"), { ssr: false, loading: () => <Skeleton className="h-[420px]" /> });

function Kpi({ label, value, hint, Icon, tour, children }: { label: string; value: string; hint: string; Icon: LucideIcon; tour?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 shadow-soft" data-tour={tour}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Icon className="size-4 text-primary" aria-hidden /> {label}
      </div>
      <div className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      <div className="text-xs text-muted">{hint}</div>
      {children}
    </div>
  );
}

export function RegencyDashboard() {
  const { t } = useT();
  return (
    <PageContainer>
      <HydrationGate>
        <DashboardInner />
      </HydrationGate>
      <p className="sr-only">{t.regency.subtitle}</p>
    </PageContainer>
  );
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

function DashboardInner() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const real = Boolean(d.data.workspace && !d.data.workspace.sample);
  const k = regencyKpis(d);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [view, setView] = useState<"map" | "list">("map");
  const [tilesFailed, setTilesFailed] = useState(false);
  const showList = view === "list" || tilesFailed || !online;
  const K = t.regency.kpis;

  const nodes: MapNode[] = [
    ...d.data.kopdes.map((x) => ({ id: x.id, name: shortKopdesName(x.name), lat: x.lat, lng: x.lng, kind: "kopdes" as const })),
    ...d.data.kitchens.map((x) => ({ id: x.id, name: x.name.replace("SPPG Demo ", "SPPG "), lat: x.lat, lng: x.lng, kind: "kitchen" as const })),
  ];
  const links: (MapLink & { pct: number })[] = d.data.kitchens.flatMap((kt) =>
    kt.linkedKopdesIds.map((kdId) => {
      const pct = linkCoverage(d, kt.id, kdId, [1, 2]);
      const from = nodes.find((n) => n.id === kdId)!;
      const to = nodes.find((n) => n.id === kt.id)!;
      return { from, to, pct, status: coverageStatus(pct), label: `${from.name} → ${to.name}: ${formatPct(pct, lang)}` };
    }),
  );

  const localData = k.weekly.map((w) => ({ week: t.kitchen.home.weekLabel(w.week), share: Math.round(w.share * 1000) / 10 }));
  const priceIngredients = ["chicken", "eggs", "catfish", "rice", "spinach"];
  const priceWeeks = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4];
  const priceData = priceWeeks.map((w) => {
    const row: Record<string, number | string> = { week: w <= 0 ? `${w}` : `+${w}` };
    for (const id of priceIngredients) {
      const ref = d.commitmentBand(id).ref;
      row[id] = Math.round((priceForWeek(d.priceIdx, id, d.today, w) / ref) * 1000) / 10;
    }
    return row;
  });

  const tables = {
    local: (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1">{t.common.week}</th>
            <th className="py-1 text-right">{K.localShare}</th>
          </tr>
        </thead>
        <tbody>
          {k.weekly.map((w) => (
            <tr key={w.week} className="border-t border-border">
              <td className="py-1.5">{t.common.weekN(w.week)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatPct(w.share, lang, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    price: (
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1">{t.common.week}</th>
            {priceIngredients.map((id) => (
              <th key={id} className="py-1 text-right">
                {nm(d.ingredientsById.get(id))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {priceData.map((r) => (
            <tr key={String(r.week)} className="border-t border-border">
              <td className="py-1.5">{r.week}</td>
              {priceIngredients.map((id) => (
                <td key={id} className="py-1.5 text-right tabular-nums">
                  {formatNumber(Number(r[id]), lang, 1)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          eyebrow={real ? `${t.common.readOnly} · ${d.data.workspace!.region || d.data.workspace!.name}` : `${t.common.readOnly} · Kabupaten Banyumas (${t.common.demoData.toLowerCase()})`}
          title={t.regency.title}
          subtitle={real ? t.regency.liveSubtitle : t.regency.subtitle}
          actions={
            <Button variant="outline" onClick={() => window.print()} data-testid="export-report">
              <Printer aria-hidden /> {t.regency.exportReport}
            </Button>
          }
        />
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t.regency.kpiLabel} data-tour="regency-kpis">
          <Kpi label={K.localShare} value={formatPct(k.localShare, lang, 1)} hint={K.localShareHint} Icon={HandCoins} tour="kpi-local" />
          <Kpi label={K.retained} value={formatRpCompact(k.retainedRp, lang)} hint={K.retainedHint} Icon={Wallet} />
          <Kpi label={K.farmers} value={formatNumber(k.farmersEngaged, lang)} hint={K.farmersHint(formatPct(k.womenPct, lang), formatPct(k.youthPct, lang))} Icon={Users} />
          <Kpi label={K.fillRate} value={formatPct(k.fillRate, lang, 1)} hint={K.fillRateHint} Icon={Gauge} tour="kpi-fill" />
          <Kpi label={K.daysToPay} value={k.avgDaysToPay === null ? "–" : formatNumber(k.avgDaysToPay, lang, 1)} hint={K.daysToPayHint} Icon={Timer} />
          <Kpi label={K.mape} value={k.mape === null ? "–" : formatPct(k.mape, lang, 1)} hint={K.mapeHint} Icon={Gauge} />
          <Kpi label={K.alerts} value={formatNumber(k.priceAlerts, lang)} hint={K.alertsHint} Icon={ShieldAlert} />
          <Kpi label={K.leftover} value={k.leftoverLatest === null ? "–" : formatPct(k.leftoverLatest, lang)} hint={K.leftoverHint} Icon={Utensils}>
            {k.leftoverByWeek.length > 1 ? <Sparkline values={k.leftoverByWeek.map((x) => x.value)} label={t.regency.leftoverTrend} className="mt-1 h-8 w-[120px]" /> : null}
          </Kpi>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{t.regency.mapTitle}</h2>
                <p className="text-sm text-muted">{t.regency.mapHint}</p>
              </div>
              <div className="flex gap-1" role="group" aria-label={t.regency.mapTitle}>
                <Button variant={showList ? "ghost" : "secondary"} size="sm" aria-pressed={!showList} onClick={() => (setView("map"), setTilesFailed(false))}>
                  <MapIcon aria-hidden /> {t.regency.mapView}
                </Button>
                <Button variant={showList ? "secondary" : "ghost"} size="sm" aria-pressed={showList} onClick={() => setView("list")}>
                  <List aria-hidden /> {t.regency.listView}
                </Button>
              </div>
            </div>
            {(tilesFailed || !online) && view === "map" ? <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">{t.regency.mapFallback}</p> : null}
            {showList ? (
              <ul className="grid gap-2" data-testid="regency-list">
                {d.data.kitchens.map((kt) => (
                  <li key={kt.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2 font-bold">
                      <ChefHat className="size-4 text-accent-strong" aria-hidden /> {kt.name}
                      <span className="text-sm font-normal text-muted">· {kt.subdistrict}</span>
                    </div>
                    <ul className="mt-2 grid gap-1.5">
                      {links
                        .filter((l) => l.to.id === kt.id)
                        .map((l) => (
                          <li key={l.from.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <Store className="size-4 text-primary" aria-hidden />
                            <span>
                              {t.regency.linkedTo}: {l.from.name}
                            </span>
                            <StatusPill status={l.status} size="sm" label={`${t.regency.coverage} ${formatPct(l.pct, lang)}`} className="ml-auto" />
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border" data-testid="regency-map">
                <RegencyMapInner nodes={nodes} links={links} onTilesFailed={() => setTilesFailed(true)} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-primary" aria-hidden /> {t.regency.kopdes}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-accent" aria-hidden /> {t.regency.kitchen}
              </span>
              <StatusPill status="green" size="sm" />
              <StatusPill status="yellow" size="sm" />
              <StatusPill status="red" size="sm" />
            </div>
          </div>

          <div className="grid gap-5">
            <ChartCard title={t.regency.chartLocal} fileName="piringtani-local-share" table={tables.local} tour="regency-local-chart">
              <div className="h-56" role="img" aria-label={t.regency.chartLocal}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={localData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART_GRID} />
                    <XAxis dataKey="week" tickLine={false} axisLine={{ stroke: CHART_GRID }} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${formatNumber(Number(v), lang, 1)}%`, K.localShare]} contentStyle={{ borderRadius: 12, borderColor: CHART_GRID }} />
                    <Bar dataKey="share" fill={STRATEGY_COLORS.piringtani} radius={[4, 4, 0, 0]} maxBarSize={24}>
                      <LabelList dataKey="share" position="top" formatter={(v) => `${formatNumber(Number(v), lang, 0)}%`} style={{ fill: CHART_AXIS_TEXT, fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title={t.regency.chartPrice} fileName="piringtani-price-stability" table={tables.price}>
              <div className="h-64" role="img" aria-label={t.regency.chartPrice}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART_GRID} />
                    <ReferenceArea y1={95} y2={110} fill="#1f6f4a" fillOpacity={0.06} />
                    <XAxis dataKey="week" tickLine={false} axisLine={{ stroke: CHART_GRID }} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} width={40} domain={[85, 125]} tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }} />
                    <Tooltip formatter={(v, name) => [formatNumber(Number(v), lang, 1), String(name)]} contentStyle={{ borderRadius: 12, borderColor: CHART_GRID }} />
                    <Legend iconType="plainline" itemSorter={null} formatter={legendText} />
                    {priceIngredients.map((id, i) => (
                      <Line key={id} isAnimationActive={false} type="linear" dataKey={id} name={nm(d.ingredientsById.get(id))} stroke={CATEGORICAL[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </section>
      </div>
      <PrintReport k={k} links={links} />
    </>
  );
}

function PrintReport({ k, links }: { k: RegencyKpis; links: (MapLink & { pct: number })[] }) {
  const { t, lang } = useT();
  const d = useDerived();
  const real = Boolean(d.data.workspace && !d.data.workspace.sample);
  const K = t.regency.kpis;
  const rows: [string, string][] = [
    [K.localShare, formatPct(k.localShare, lang, 1)],
    [K.retained, formatRpCompact(k.retainedRp, lang)],
    [K.farmers, `${k.farmersEngaged} (${K.farmersHint(formatPct(k.womenPct, lang), formatPct(k.youthPct, lang))})`],
    [K.fillRate, formatPct(k.fillRate, lang, 1)],
    [K.daysToPay, k.avgDaysToPay === null ? "–" : formatNumber(k.avgDaysToPay, lang, 1)],
    [K.mape, k.mape === null ? "–" : formatPct(k.mape, lang, 1)],
    [K.alerts, String(k.priceAlerts)],
    [K.leftover, k.leftoverLatest === null ? "–" : formatPct(k.leftoverLatest, lang)],
  ];
  return (
    <section className="print-only print-report">
      <h1 style={{ fontSize: "18pt", fontWeight: 800, color: "#17573a" }}>{real ? t.regency.liveReportTitle(d.data.workspace!.name) : t.regency.reportTitle}</h1>
      <p style={{ marginBottom: "10pt" }}>
        {t.common.demoClock}: {formatDate(d.today, lang, { weekday: true, year: true })} · {t.common.tagline}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12pt" }}>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} style={{ borderBottom: "1px solid #e4dfd3" }}>
              <td style={{ padding: "4pt 0" }}>{a}</td>
              <td style={{ padding: "4pt 0", textAlign: "right", fontWeight: 700 }}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: "13pt", fontWeight: 700, margin: "8pt 0 4pt" }}>{t.regency.mapTitle}</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12pt" }}>
        <tbody>
          {links.map((l) => (
            <tr key={`${l.from.id}-${l.to.id}`} style={{ borderBottom: "1px solid #e4dfd3" }}>
              <td style={{ padding: "4pt 0" }}>{l.from.name} → {l.to.name}</td>
              <td style={{ padding: "4pt 0", textAlign: "right" }}>
                {t.regency.coverage} {formatPct(l.pct, lang)} ({t.status[l.status]})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: "13pt", fontWeight: 700, margin: "8pt 0 4pt" }}>{t.regency.chartLocal}</h2>
      <p>{k.weekly.map((w) => `${t.common.weekN(w.week)}: ${formatPct(w.share, lang, 1)}`).join(" · ")}</p>
      <p style={{ marginTop: "14pt", fontSize: "9pt", color: "#5b6b63" }}>
        {real ? `${t.regency.liveReportFooter} ${t.footer.competition}.` : `${t.regency.reportFooter} ${t.common.fictional} ${t.footer.competition}.`}
      </p>
    </section>
  );
}
