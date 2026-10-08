"use client";

import { CircleCheck, CircleX, Inbox } from "lucide-react";
import { formatDate, formatDateTime } from "@/engines/format";
import { schoolDayDate } from "@/engines/time";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { KitchenShell } from "./kitchen-shell";
import { SuggestionCard } from "./suggestion-card";

export function SwitchInbox() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const kitchenId = d.data.ui.activeKitchenId;
  const list = d.suggestions.get(kitchenId) ?? [];
  const decisions = d.data.decisions
    .filter((x) => x.key.startsWith(`${kitchenId}:`))
    .slice()
    .reverse()
    .slice(0, 6)
    .map((x) => {
      const [, week, dayIndex, fromDishId] = x.key.split(":");
      const o = d.data.overrides.find((ov) => ov.suggestionId === x.suggestionId);
      return { ...x, week: Number(week), dayIndex: Number(dayIndex), fromDishId, override: o };
    });
  return (
    <KitchenShell title={t.kitchen.switch.title} subtitle={t.kitchen.switch.subtitle}>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="grid content-start gap-4" aria-label={t.kitchen.switch.title}>
          {list.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center text-muted">
              <Inbox className="size-10" aria-hidden />
              <p className="max-w-md">{t.kitchen.switch.noSuggestions}</p>
            </div>
          ) : (
            list.map((s, i) => <SuggestionCard key={s.id} s={s} tour={i === 0 ? "switch-top" : undefined} />)
          )}
        </section>
        <aside className="grid content-start gap-3">
          <h2 className="text-lg font-bold">{t.kitchen.switch.decidedTitle}</h2>
          {decisions.length === 0 ? <p className="text-sm text-muted">{t.kitchen.switch.noDecisions}</p> : null}
          <ul className="grid gap-2">
            {decisions.map((x) => {
              const approved = x.status === "approved";
              const fromDish = d.dishesById.get(x.override?.fromDishId ?? x.fromDishId);
              const toDish = x.override ? d.dishesById.get(x.override.toDishId) : undefined;
              const date = schoolDayDate(d.today, x.week, (x.dayIndex - 1) % 5);
              return (
                <li key={x.key} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className={approved ? "flex items-center gap-1.5 font-bold text-ok-strong" : "flex items-center gap-1.5 font-bold text-muted"}>
                    {approved ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
                    {approved ? t.kitchen.switch.approved : t.kitchen.switch.rejected}
                    <span className="ml-auto font-normal text-muted">{formatDateTime(x.decidedAt, lang)}</span>
                  </div>
                  <p className="mt-1">
                    {formatDate(date, lang, { weekday: true })} · {t.common.weekN(x.week)}
                  </p>
                  <p className="text-muted">{toDish ? t.kitchen.switch.swapLine(nm(fromDish), nm(toDish)) : nm(fromDish)}</p>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </KitchenShell>
  );
}
