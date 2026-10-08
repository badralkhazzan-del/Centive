"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, PackageCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IngredientLabel } from "@/components/common/ingredient";
import { StatusPill } from "@/components/common/status";
import { formatDate, formatKg, formatPct } from "@/engines/format";
import { addDays } from "@/engines/time";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { shortKopdesName } from "@/lib/names";
import { KitchenShell } from "./kitchen-shell";
import { SuggestionCard } from "./suggestion-card";

export function KitchenHome() {
  const { t } = useT();
  return (
    <KitchenShell title={t.kitchen.home.title} subtitle={t.kitchen.home.subtitle}>
      <div className="grid gap-5 lg:grid-cols-3">
        <CoverageCard />
        <SwitchCard />
        <DeliveriesCard />
      </div>
    </KitchenShell>
  );
}

function CoverageCard() {
  const { t, lang } = useT();
  const d = useDerived();
  const [all, setAll] = useState(false);
  const kitchenId = d.data.ui.activeKitchenId;
  const rows = d.data.ingredients
    .map((ing) => ({ ing, w1: d.kitchenCoverage(kitchenId, ing.id, 1), w2: d.kitchenCoverage(kitchenId, ing.id, 2) }))
    .filter((r) => r.w1 || r.w2)
    .map((r) => ({ ...r, min: Math.min(r.w1?.pct ?? 1, r.w2?.pct ?? 1) }))
    .sort((a, b) => a.min - b.min);
  const shown = all ? rows : rows.slice(0, 5);
  return (
    <Card data-tour="home-coverage">
      <CardHeader>
        <CardTitle>{t.kitchen.home.coverageTitle}</CardTitle>
        <CardDescription>{t.kitchen.home.coverageHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 ? <p className="text-muted">{t.kitchen.home.coverageEmpty}</p> : null}
        <ul className="divide-y divide-border">
          {shown.map((r) => (
            <li key={r.ing.id} className="flex items-center gap-2 py-2.5">
              <IngredientLabel ingredient={r.ing} className="min-w-0 flex-1 truncate font-semibold" />
              {[r.w1, r.w2].map((c, i) => (
                <span key={i} className="flex flex-col items-end gap-0.5">
                  <span className="text-[11px] font-bold text-muted">{t.kitchen.home.weekLabel(i + 1)}</span>
                  {c ? <StatusPill status={c.status} size="sm" label={formatPct(c.pct, lang)} /> : <StatusPill status="none" size="sm" label="–" />}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {rows.length > 5 ? (
            <Button variant="link" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? t.common.hideDetails : t.common.seeDetails}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/kitchen/forecast">
              {t.kitchen.home.seeForecast} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SwitchCard() {
  const { t } = useT();
  const d = useDerived();
  const list = d.suggestions.get(d.data.ui.activeKitchenId) ?? [];
  const top = list[0];
  return (
    <Card className="border-accent/50" data-tour="home-switch">
      <CardHeader>
        <CardTitle>{t.kitchen.home.switchTitle}</CardTitle>
        <CardDescription data-testid="pending-count">{list.length ? t.kitchen.home.pending(list.length) : t.kitchen.home.noPending}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {top ? <SuggestionCard s={top} compact /> : null}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kitchen/switch">
            {t.kitchen.home.openInbox} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DeliveriesCard() {
  const { t, lang } = useT();
  const d = useDerived();
  const today = d.today;
  const tomorrow = addDays(today, 1);
  const list = d.data.batches
    .filter((b) => b.kitchenId === d.data.ui.activeKitchenId && !b.deliveredAt && (b.plannedDeliveryDate === today || b.plannedDeliveryDate === tomorrow))
    .sort((a, b) => a.plannedDeliveryDate.localeCompare(b.plannedDeliveryDate));
  return (
    <Card data-tour="home-deliveries">
      <CardHeader>
        <CardTitle>{t.kitchen.home.deliveriesTitle}</CardTitle>
        <CardDescription>
          {formatDate(today, lang, { weekday: true })} – {formatDate(tomorrow, lang, { weekday: true })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="flex items-center gap-2 text-muted">
            <PackageCheck className="size-5" aria-hidden /> {t.kitchen.home.noDeliveries}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Truck className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 font-semibold">
                    <IngredientLabel ingredient={d.ingredientsById.get(b.ingredientId)} />
                    <span className="text-muted">{formatKg(b.kg, lang)}</span>
                  </div>
                  <div className="text-sm text-muted">
                    {b.plannedDeliveryDate === today ? t.common.today : t.common.tomorrow} · {b.id} ·{" "}
                    {shortKopdesName(d.kopdesById.get(b.kopdesId)?.name ?? "")}
                  </div>
                </div>
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/kitchen/receive?code=${b.id}`}>{t.kitchen.home.receive}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
