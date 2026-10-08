"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import type { Leftover } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LEFTOVER_VALUE } from "@/engines/derive";
import { formatDate, formatPct } from "@/engines/format";
import { resolveDay } from "@/engines/menu";
import { addDays, isoWeekday, weekOfDate } from "@/engines/time";
import { useT } from "@/i18n";
import { actions, useDerived } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { KitchenShell } from "./kitchen-shell";
import { IngredientLabel } from "@/components/common/ingredient";

const OPTIONS: Leftover[] = ["none", "quarter", "half", "most"];

/** Pie-like glyph showing how much is left on the plate. */
function PlateGlyph({ value }: { value: Leftover }) {
  const frac = LEFTOVER_VALUE[value];
  const angle = frac * 2 * Math.PI;
  const x = 16 + 11 * Math.sin(angle);
  const y = 16 - 11 * Math.cos(angle);
  const large = frac > 0.5 ? 1 : 0;
  return (
    <svg viewBox="0 0 32 32" className="size-9" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
      {frac > 0 ? <path d={`M16 16 L16 5 A11 11 0 ${large} 1 ${x} ${y} Z`} fill="currentColor" opacity="0.55" /> : null}
    </svg>
  );
}

export function PlateFeedbackView() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const k = d.kitchensById.get(d.data.ui.activeKitchenId)!;
  const cycle = d.cyclesByKitchen.get(k.id)!;
  // Last five school days up to today.
  const dates: string[] = [];
  for (let i = 0; dates.length < 5 && i < 14; i++) {
    const date = addDays(d.today, -i);
    if (isoWeekday(date) <= 5) dates.push(date);
  }
  const [date, setDate] = useState(dates[0]);
  const dow = isoWeekday(date) - 1;
  const weekOf = weekOfDate(d.today, date);
  const day = resolveDay(k, cycle, d.dishesById, d.data.overrides, d.today, weekOf, dow);
  const saved = (dishId: string) => d.data.plateFeedback.find((p) => p.kitchenId === k.id && p.date === date && p.dishId === dishId)?.leftover;

  const mains = ["chicken", "eggs", "catfish", "tilapia", "tempe", "tofu", "spinach", "kangkung"];
  return (
    <KitchenShell title={t.kitchen.feedback.title} subtitle={t.kitchen.feedback.subtitle}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.kitchen.menu.calendarTitle}>
            {dates.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={x === date}
                onClick={() => setDate(x)}
                className={cn(
                  "min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                  x === date ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-muted-surface",
                )}
              >
                {x === d.today ? `${t.common.today} · ` : ""}
                {formatDate(x, lang, { weekday: true })}
              </button>
            ))}
          </div>
          {!day.operating ? (
            <p className="text-muted">{t.kitchen.feedback.noSchool}</p>
          ) : (
            day.dishes
              .filter((x) => x.dishId !== "nasi_putih")
              .map((x) => {
                const dish = d.dishesById.get(x.dishId)!;
                const current = saved(dish.id);
                return (
                  <Card key={dish.id}>
                    <CardContent className="grid gap-3 pt-5">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-lg font-bold">{nm(dish)}</h2>
                        {current ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-ok-strong">
                            <CircleCheck className="size-4" aria-hidden /> {t.kitchen.feedback.savedFor(formatDate(date, lang))}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={nm(dish)}>
                        {OPTIONS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={current === o}
                            onClick={() => actions.addPlateFeedback(k.id, date, dish.id, o)}
                            className={cn(
                              "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 text-base font-bold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                              current === o ? "border-primary bg-primary-soft text-primary-strong" : "border-border bg-surface text-foreground hover:bg-muted-surface",
                            )}
                          >
                            <PlateGlyph value={o} />
                            {t.kitchen.feedback.options[o]}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t.kitchen.feedback.acceptance}</CardTitle>
            <CardDescription>{t.kitchen.feedback.acceptanceHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2.5">
              {mains
                .map((id) => ({ ing: d.ingredientsById.get(id)!, v: d.acceptance(k.id, id) }))
                .sort((a, b) => b.v - a.v)
                .map(({ ing, v }) => (
                  <li key={ing.id} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
                    <IngredientLabel ingredient={ing} className="font-semibold" />
                    <span className="h-2.5 overflow-hidden rounded-full bg-muted-surface">
                      <span className={cn("block h-full rounded-full", v >= 0.75 ? "bg-ok" : v >= 0.6 ? "bg-warn" : "bg-danger")} style={{ width: `${Math.round(v * 100)}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{formatPct(v, lang)}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </KitchenShell>
  );
}
