"use client";

import { useParams, useSearchParams } from "next/navigation";
import { CircleCheck, PackageSearch, ShieldCheck, Snowflake } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { HydrationGate } from "@/components/common/gate";
import { formatDate, formatDateTime, formatKg } from "@/engines/format";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { decodeTrace } from "@/lib/trace";

interface View {
  code: string;
  ingredientId: string;
  kg: number;
  grade: "A" | "B";
  harvestDate: string;
  farmers: [string, string][];
  kopdesId: string;
  kitchenId: string;
  cold: boolean;
  planned: string;
  deliveredAt?: string;
  kopdesName?: string;
  kitchenName?: string;
  ingredientName?: [string, string];
  live?: boolean;
}

export function TraceView() {
  return (
    <HydrationGate rows={1}>
      <TraceInner />
    </HydrationGate>
  );
}

function TraceInner() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = decodeURIComponent(params.code ?? "").toUpperCase();
  const batch = d.data.batches.find((b) => b.id === code);
  let view: View | null = null;
  if (batch) {
    view = {
      code,
      ingredientId: batch.ingredientId,
      kg: batch.kg,
      grade: batch.grade,
      harvestDate: batch.harvestDate,
      farmers: batch.farmerIds
        .map((id) => d.farmersById.get(id))
        .filter((f) => f !== undefined)
        .map((f) => [f.displayName, f.village] as [string, string]),
      kopdesId: batch.kopdesId,
      kitchenId: batch.kitchenId,
      cold: batch.coldChainChecked,
      planned: batch.plannedDeliveryDate,
      deliveredAt: batch.deliveredAt,
      live: Boolean(d.data.workspace && !d.data.workspace.sample),
    };
  } else {
    const p = decodeTrace(search.get("d"));
    if (p)
      view = {
        code,
        ingredientId: p.i,
        kg: p.kg,
        grade: p.g,
        harvestDate: p.h,
        farmers: p.f,
        kopdesId: p.kd,
        kitchenId: p.kt,
        cold: p.c,
        planned: p.p,
        kopdesName: p.kdn,
        kitchenName: p.ktn,
        ingredientName: p.in,
        live: p.l === 1,
      };
  }

  if (!view) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
        <PackageSearch className="size-10 text-muted" aria-hidden />
        <h1 className="text-xl font-bold">{t.trace.notFound}</h1>
        <p className="font-mono text-lg">{code}</p>
        <p className="text-muted">{t.trace.notFoundBody}</p>
      </div>
    );
  }
  const ing = d.ingredientsById.get(view.ingredientId);
  const animal = ing?.foodGroup === "animal_protein";
  const rows: [string, React.ReactNode][] = [
    [t.trace.ingredient, ing ? `${ing.emoji} ${nm(ing)}` : view.ingredientName ? (lang === "id" ? view.ingredientName[1] : view.ingredientName[0]) : view.ingredientId],
    [t.trace.kg, formatKg(view.kg, lang)],
    [t.trace.grade, view.grade],
    [t.trace.harvest, formatDate(view.harvestDate, lang, { weekday: true, year: true })],
    [t.trace.farmers, view.farmers.map(([n, v]) => `${n} (${v})`).join(", ")],
    [t.trace.kopdes, view.kopdesName ?? d.kopdesById.get(view.kopdesId)?.name ?? view.kopdesId],
    [t.trace.kitchen, view.kitchenName ?? d.kitchensById.get(view.kitchenId)?.name ?? view.kitchenId],
    [t.trace.delivered, view.deliveredAt ? formatDateTime(view.deliveredAt, lang) : `${t.trace.notDelivered} (${formatDate(view.planned, lang, { weekday: true })})`],
    [t.trace.coldChain, animal ? (view.cold ? t.trace.coldOk : t.trace.coldMissing) : t.trace.coldNa],
  ];
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft" data-testid="trace-card">
      <header className="flex items-center gap-3 bg-primary px-5 py-4 text-primary-foreground">
        <span className="rounded-full bg-white p-0.5">
          <LogoMark className="size-10" />
        </span>
        <div>
          <p className="text-sm font-semibold opacity-90">{t.trace.title}</p>
          <h1 className="font-mono text-2xl font-extrabold tracking-wider">{view.code}</h1>
        </div>
      </header>
      <p className="px-5 pt-4 text-sm text-muted">{t.trace.subtitle}</p>
      <dl className="divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3 px-5 py-3">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <footer className="grid gap-2 bg-muted-surface px-5 py-4 text-sm">
        {view.deliveredAt ? (
          <p className="flex items-center gap-2 font-semibold text-ok-strong">
            <CircleCheck className="size-4" aria-hidden /> {t.trace.verified}
          </p>
        ) : null}
        {animal && view.cold ? (
          <p className="flex items-center gap-2 text-muted">
            <Snowflake className="size-4" aria-hidden /> {t.trace.coldChain}: {t.trace.coldOk}
          </p>
        ) : null}
        <p className="flex items-center gap-2 text-muted">
          <ShieldCheck className="size-4" aria-hidden /> {t.trace.privacy}
        </p>
        {view.live ? null : (
          <p className="text-xs text-muted">
            {t.common.demoData} · {t.common.fictional}
          </p>
        )}
      </footer>
    </article>
  );
}
