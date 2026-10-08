"use client";

import { useState } from "react";
import { BadgeCheck, Clock, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IngredientLabel } from "@/components/common/ingredient";
import { StatusPill } from "@/components/common/status";
import { useToast } from "@/components/common/toast";
import { formatDate, formatKg, formatNumber, formatRp } from "@/engines/format";
import { STAGES } from "@/engines/payment";
import { averageDaysToFarmerPayment } from "@/engines/payment";
import { useT } from "@/i18n";
import { actions, useDerived } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { KopdesShell } from "./kopdes-shell";

type Filter = "open" | "overdue" | "all";

export function PaymentsList() {
  const { t, lang } = useT();
  const d = useDerived();
  const notify = useToast();
  const [filter, setFilter] = useState<Filter>("open");
  const [limit, setLimit] = useState(12);
  const kopdesId = d.data.ui.activeKopdesId;
  const L = t.kopdes.payments;
  const rows = d.paymentRows.filter((r) => r.batch?.kopdesId === kopdesId);
  const overdue = rows.filter((r) => r.status.overdue);
  const filtered = rows.filter((r) => (filter === "all" ? true : filter === "overdue" ? r.status.overdue : r.status.stage !== "farmer_paid"));
  const avg = averageDaysToFarmerPayment(rows.map((r) => r.payment));
  const sla = d.data.settings.paymentSlaDays;

  return (
    <KopdesShell title={L.title} subtitle={L.subtitle}>
      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <div className="text-sm text-muted">{L.avgDays}</div>
            <div className="text-3xl font-extrabold tabular-nums" data-testid="avg-days">
              {avg === null ? "–" : formatNumber(avg, lang, 1)}
            </div>
            <div className="text-xs text-muted">{L.sla(sla)}</div>
          </div>
          <div className={cn("rounded-2xl border p-4 shadow-soft", overdue.length ? "border-danger/40 bg-danger-soft/40" : "border-border bg-surface")}>
            <div className="text-sm text-muted">{t.status.overdue}</div>
            <div className="text-3xl font-extrabold tabular-nums text-danger-strong">{overdue.length}</div>
            <div className="text-xs text-muted">{L.overdueCount(overdue.length)}</div>
          </div>
        </div>
        <div role="group" aria-label="Filter" className="grid grid-cols-3 gap-1 rounded-xl bg-muted-surface p-1">
          {(["open", "overdue", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "min-h-11 rounded-lg text-sm font-bold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                filter === f ? "bg-surface text-foreground shadow-sm" : "text-muted",
              )}
            >
              {L.filters[f]}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? <p className="text-muted">{L.none}</p> : null}
        <ul className="grid grid-cols-1 gap-3">
          {filtered.slice(0, limit).map(({ payment, batch, status }) => (
            <li
              key={payment.batchId}
              className={cn("grid grid-cols-1 gap-3 rounded-2xl border bg-surface p-4 shadow-soft", status.overdue ? "border-danger/50" : "border-border")}
              data-testid={`payment-${payment.batchId}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold">{payment.batchId}</span>
                {batch ? <IngredientLabel ingredient={d.ingredientsById.get(batch.ingredientId)} className="font-semibold" /> : null}
                {batch ? <span className="text-sm text-muted">{formatKg(batch.kg, lang)}</span> : null}
                <span className="ml-auto">{status.overdue ? <StatusPill status="red" label={t.status.overdue} /> : status.stage === "farmer_paid" ? <StatusPill status="green" label={L.stages.farmer_paid} /> : <StatusPill status="yellow" label={t.status.pending} />}</span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="text-muted">
                  {batch ? d.kitchensById.get(batch.kitchenId)?.name : ""} · {formatDate(payment.deliveredAt.slice(0, 10), lang, { weekday: true })}
                </span>
                <span className="text-base font-bold tabular-nums">{formatRp(payment.amountRp, lang)}</span>
              </div>
              <ol className="grid grid-cols-4 gap-1" aria-label={t.kopdes.payments.title}>
                {STAGES.map((s, i) => {
                  const done = i <= status.stageIndex;
                  return (
                    <li key={s} className="grid grid-cols-1 gap-1">
                      <span className={cn("h-1.5 rounded-full", done ? (status.overdue && i === status.stageIndex ? "bg-danger" : "bg-ok") : "bg-muted-surface")} />
                      <span className={cn("text-[11px] leading-tight", done ? "font-semibold text-foreground" : "text-muted")}>{L.stages[s]}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 text-muted">
                  <Clock className="size-4" aria-hidden />
                  {status.stage === "farmer_paid" ? L.paidIn(formatNumber(status.daysOpen, lang)) : `${L.daysOpen(status.daysOpen)} · ${status.waitingOn ? L.waiting[status.waitingOn] : ""}`}
                </span>
                {status.financingReady ? (
                  <Badge variant="default" title={L.financingNote}>
                    <BadgeCheck aria-hidden /> {L.financingReady}
                  </Badge>
                ) : null}
              </div>
              {status.stage === "verified" || status.stage === "kitchen_paid" ? (
                <div className="flex flex-wrap gap-2">
                  {status.stage === "verified" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        actions.markKitchenPaid(payment.batchId);
                        notify(L.stages.kitchen_paid);
                      }}
                    >
                      {L.markKitchenPaid}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        actions.markFarmersPaid(payment.batchId);
                        notify(L.stages.farmer_paid);
                      }}
                      data-testid={`pay-farmers-${payment.batchId}`}
                    >
                      {L.markFarmersPaid}
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {filtered.length > limit ? (
          <Button variant="outline" onClick={() => setLimit((l) => l + 12)}>
            {t.common.seeDetails} ({filtered.length - limit})
          </Button>
        ) : null}
        <p className="flex gap-2 rounded-2xl bg-muted-surface p-4 text-sm text-muted">
          <Landmark className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /> {L.financingNote}
        </p>
      </div>
    </KopdesShell>
  );
}
