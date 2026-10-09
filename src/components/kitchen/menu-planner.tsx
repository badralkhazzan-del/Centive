"use client";

import { useState } from "react";
import { CalendarDays, Lock, LockOpen, Shuffle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/common/toast";
import { formatDate, formatNumber, formatRp, weekdayName } from "@/engines/format";
import { allComponents, resolveDay, type ResolvedDay } from "@/engines/menu";
import { portionCost, portionNutrition } from "@/engines/nutrition";
import { BUDGET_RP } from "@/engines/substitution";
import { schoolDayDate, weekStart, addDays } from "@/engines/time";
import { useT } from "@/i18n";
import { actions, useDerived } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { KitchenShell } from "./kitchen-shell";

export function MenuPlanner() {
  const { t } = useT();
  const [panelOpen, setPanelOpen] = useState(false);
  return (
    <KitchenShell
      title={t.kitchen.menu.title}
      subtitle={t.kitchen.menu.subtitle}
      actions={
        <Button variant="outline" onClick={() => setPanelOpen(true)} data-testid="open-kitchen-panel">
          <Users aria-hidden /> {t.kitchen.menu.editPanel}
        </Button>
      }
    >
      <MenuGrid />
      <KitchenPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </KitchenShell>
  );
}

function MenuGrid() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const [cycle, setCycle] = useState<"a" | "b">("a");
  const [openDay, setOpenDay] = useState<ResolvedDay | null>(null);
  const k = d.kitchensById.get(d.data.ui.activeKitchenId)!;
  const menuCycle = d.cyclesByKitchen.get(k.id)!;
  const weeks = cycle === "a" ? [1, 2, 3, 4] : [5, 6, 7, 8];
  const days = weeks.map((w) => [0, 1, 2, 3, 4].map((dow) => resolveDay(k, menuCycle, d.dishesById, d.data.overrides, d.today, w, dow)));
  const selected = openDay ? resolveDay(k, menuCycle, d.dishesById, d.data.overrides, d.today, openDay.week, openDay.dow) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t.kitchen.menu.title} className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted-surface p-1">
          {(["a", "b"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                cycle === c ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {c === "a" ? t.kitchen.menu.cycleA : t.kitchen.menu.cycleB}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Lock className="size-4" aria-hidden /> {t.kitchen.menu.lockHint}
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
          <caption className="sr-only">{t.kitchen.menu.title}</caption>
          <thead>
            <tr className="border-b border-border bg-muted-surface/60 text-sm">
              <th scope="col" className="w-28 p-3 font-bold">
                {t.common.week}
              </th>
              {[0, 1, 2, 3, 4].map((dow) => (
                <th key={dow} scope="col" className="p-3 font-bold">
                  {weekdayName(schoolDayDate(d.today, 1, dow), lang, true)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((row, i) => (
              <tr key={weeks[i]} className="border-b border-border last:border-0">
                <th scope="row" className="p-3 align-top text-sm">
                  <div className="font-bold">{t.common.weekN(weeks[i])}</div>
                  <div className="text-xs font-normal text-muted">
                    {formatDate(weekStart(d.today, weeks[i]), lang)} – {formatDate(addDays(weekStart(d.today, weeks[i]), 4), lang)}
                  </div>
                </th>
                {row.map((day) => {
                  const main = day.dishes[1];
                  const switched = day.dishes.some((x) => x.switchedFromDishId);
                  const locked = day.dishes.some((x) => menuCycle.lockedDishIds.includes(x.dishId) && x.dishId !== "nasi_putih");
                  return (
                    <td key={day.date} className="p-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => setOpenDay(day)}
                        data-testid={`menu-day-${day.week}-${day.dow}`}
                        className={cn(
                          "flex h-full min-h-32 w-full flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                          !day.operating && "border-dashed bg-muted-surface text-muted",
                          switched && "border-2 border-accent bg-accent-soft/50",
                          day.operating && !switched && "border-border bg-surface",
                        )}
                      >
                        <span className="flex items-center justify-between text-xs font-semibold text-muted">
                          {formatDate(day.date, lang)}
                          <span className="flex gap-1">
                            {locked ? <Lock className="size-3.5" aria-label={t.kitchen.menu.locked} /> : null}
                            {switched ? <Shuffle className="size-3.5 text-accent-strong" aria-label={t.kitchen.menu.switched} /> : null}
                          </span>
                        </span>
                        {!day.operating ? (
                          <span className="text-sm font-bold">{t.kitchen.menu.holiday}</span>
                        ) : (
                          <>
                            <span className="text-sm font-bold leading-snug">{nm(d.dishesById.get(main?.dishId ?? ""))}</span>
                            <span className="text-xs leading-snug text-muted">
                              {day.dishes
                                .filter((x) => x !== main && x.dishId !== "nasi_putih")
                                .map((x) => nm(d.dishesById.get(x.dishId)))
                                .join(" · ")}
                            </span>
                            {switched ? (
                              <Badge variant="accent" className="mt-auto w-fit text-xs">
                                {t.kitchen.menu.switched}
                              </Badge>
                            ) : null}
                          </>
                        )}
                        {day.holidayName ? <span className="text-xs">{lang === "id" ? day.holidayName.id : day.holidayName.en}</span> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setOpenDay(null)}>
        {selected ? <DayDetail day={selected} /> : null}
      </Dialog>
    </div>
  );
}

function DayDetail({ day }: { day: ResolvedDay }) {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const k = d.kitchensById.get(day.kitchenId)!;
  const cycle = d.cyclesByKitchen.get(k.id)!;
  const comps = allComponents(day);
  const price = (id: string) => d.price(id, day.week);
  return (
    <DialogContent closeLabel={t.common.close} className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{t.kitchen.menu.dayTitle(formatDate(day.date, lang, { weekday: true }))}</DialogTitle>
        <DialogDescription>
          {t.common.weekN(day.week)} · {t.kitchen.menu.dishCount(day.dishes.length)}
        </DialogDescription>
      </DialogHeader>
      {!day.operating ? (
        <p className="text-muted">{t.kitchen.menu.holiday}</p>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {day.dishes.map((x) => {
              const dish = d.dishesById.get(x.dishId)!;
              const locked = cycle.lockedDishIds.includes(dish.id);
              return (
                <li key={x.dishId} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{nm(dish)}</div>
                    {x.switchedFromDishId ? (
                      <div className="text-xs font-semibold text-accent-strong">{t.kitchen.menu.switchedFrom(nm(d.dishesById.get(x.switchedFromDishId)))}</div>
                    ) : null}
                    <div className="text-xs text-muted">
                      {x.components
                        .map((c) => `${nm(d.ingredientsById.get(c.ingredientId))} ${c.grams.small}/${c.grams.large} g`)
                        .join(" · ")}
                    </div>
                  </div>
                  <Button
                    variant={locked ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={locked}
                    onClick={() => actions.toggleDishLock(k.id, dish.id)}
                    data-testid={`lock-${dish.id}`}
                  >
                    {locked ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                    <span className="hidden sm:inline">{locked ? t.kitchen.menu.unlock : t.kitchen.menu.lock}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
          <table className="w-full text-sm">
            <caption className="mb-1 text-left text-xs font-bold uppercase tracking-wide text-muted">{t.kitchen.menu.perPortion}</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1"> </th>
                <th className="py-1">{t.kitchen.menu.energy}</th>
                <th className="py-1">{t.kitchen.menu.protein}</th>
                <th className="py-1">{t.kitchen.menu.cost}</th>
              </tr>
            </thead>
            <tbody>
              {(["small", "large"] as const).map((size) => {
                const n = portionNutrition(comps, size, d.ingredientsById);
                const cost = portionCost(comps, size, d.ingredientsById, price, k.seasoningCostRp[size]);
                const ok = cost <= BUDGET_RP[size];
                return (
                  <tr key={size} className="border-t border-border">
                    <td className="py-2 font-semibold">{size === "small" ? t.common.small : t.common.large}</td>
                    <td className="py-2 tabular-nums">{formatNumber(n.energyKcal, lang)} kcal</td>
                    <td className="py-2 tabular-nums">{formatNumber(n.proteinG, lang, 1)} g</td>
                    <td className="py-2 tabular-nums">
                      {formatRp(cost, lang)}{" "}
                      <span className={ok ? "text-xs font-semibold text-ok-strong" : "text-xs font-semibold text-danger-strong"}>
                        ({ok ? t.kitchen.menu.withinBudget : t.kitchen.menu.overBudget}, {t.kitchen.menu.budget} {formatRp(BUDGET_RP[size], lang)})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </DialogContent>
  );
}

function KitchenPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang } = useT();
  const d = useDerived();
  const notify = useToast();
  const k = d.kitchensById.get(d.data.ui.activeKitchenId)!;
  const [small, setSmall] = useState(String(k.beneficiaries.small));
  const [large, setLarge] = useState(String(k.beneficiaries.large));
  const [att, setAtt] = useState(Math.round(k.attendanceRate * 100));
  const [lastKitchen, setLastKitchen] = useState(k.id);
  if (lastKitchen !== k.id) {
    setLastKitchen(k.id);
    setSmall(String(k.beneficiaries.small));
    setLarge(String(k.beneficiaries.large));
    setAtt(Math.round(k.attendanceRate * 100));
  }
  const save = () => {
    const s = Math.max(0, Math.round(Number(small) || 0));
    const l = Math.max(0, Math.round(Number(large) || 0));
    actions.updateKitchen(k.id, { beneficiaries: { small: s, large: l }, attendanceRate: att / 100 });
    notify(t.common.saved);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.kitchen.menu.editPanel}</DialogTitle>
          <DialogDescription>
            {k.name} · {t.kitchen.menu.editPanelHint}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ben-small">{t.kitchen.menu.beneficiariesSmall}</Label>
            <Input id="ben-small" type="number" inputMode="numeric" min={0} value={small} onChange={(e) => setSmall(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ben-large">{t.kitchen.menu.beneficiariesLarge}</Label>
            <Input id="ben-large" type="number" inputMode="numeric" min={0} value={large} onChange={(e) => setLarge(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="attendance">
              {t.kitchen.menu.attendance}: <span className="tabular-nums">{att}%</span>
            </Label>
            <input id="attendance" type="range" min={70} max={100} value={att} onChange={(e) => setAtt(Number(e.target.value))} className="h-11 accent-[#1f6f4a]" />
          </div>
          <Button onClick={save}>{t.common.save}</Button>
        </div>
        <div className="grid gap-2 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 font-bold">
            <CalendarDays className="size-5 text-primary" aria-hidden /> {t.kitchen.menu.calendarTitle}
          </h3>
          <p className="text-sm text-muted">{t.kitchen.menu.calendarHint}</p>
          <div className="grid gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
              <div key={w} className="grid grid-cols-[4.5rem_repeat(5,1fr)] items-center gap-1">
                <span className="text-xs font-bold text-muted">{t.common.weekN(w)}</span>
                {[0, 1, 2, 3, 4].map((dow) => {
                  const date = schoolDayDate(d.today, w, dow);
                  const holiday = k.schoolCalendar.holidays.find((h) => h.date === date);
                  return (
                    <button
                      key={date}
                      type="button"
                      aria-pressed={Boolean(holiday)}
                      title={holiday ? (lang === "id" ? holiday.nameId : holiday.nameEn) : undefined}
                      onClick={() => actions.toggleHoliday(k.id, date)}
                      className={cn(
                        "min-h-11 rounded-lg border text-xs font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                        holiday ? "border-danger/40 bg-danger-soft text-danger-strong" : "border-border bg-surface hover:bg-muted-surface",
                      )}
                    >
                      <span className="sr-only">{formatDate(date, lang, { weekday: true })}: </span>
                      {formatDate(date, lang).split(" ")[0]}
                      <span className="sr-only"> {holiday ? t.kitchen.menu.holiday : ""}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
