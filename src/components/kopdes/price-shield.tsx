"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IngredientLabel } from "@/components/common/ingredient";
import { Sparkline } from "@/components/common/sparkline";
import { useToast } from "@/components/common/toast";
import { WhyLine } from "@/components/common/why";
import { formatRp, formatWeeks } from "@/engines/format";
import type { ShieldAction } from "@/engines/priceShield";
import { useT } from "@/i18n";
import { actions, useDerived } from "@/lib/repo";

export function PriceShieldPanel() {
  const { t, lang, lt } = useT();
  const d = useDerived();
  const router = useRouter();
  const notify = useToast();
  const [all, setAll] = useState(false);
  const kopdesId = d.data.ui.activeKopdesId;
  const groups = d.shieldGroups.get(kopdesId) ?? [];
  const shown = all ? groups : groups.slice(0, 2);
  const L = t.kopdes.board;

  const act = (a: ShieldAction, ingredientId: string, weeks: number[], kind: string) => {
    if (a === "neighbor") {
      const r = actions.requestNeighbor(kopdesId, ingredientId, weeks.filter((w) => d.windowWeeks.includes(w)));
      notify(r.created.length ? L.offersSent(r.created.length, `${r.created.reduce((s, c) => s + c.kgPerWeek, 0)} kg`) : L.shieldDone.neighbor, "info");
      return;
    }
    if (a === "menu_switch") {
      if (kind === "demand_share") actions.requestMenuSwitch(kopdesId, ingredientId, weeks.filter((w) => w >= 1));
      router.push("/kitchen/switch");
      return;
    }
    notify(L.shieldDone.spread, "info");
  };

  return (
    <section className="grid grid-cols-1 gap-3" aria-labelledby="shield-title" data-tour="price-shield">
      <h2 id="shield-title" className="flex items-center gap-2 text-lg font-bold">
        <ShieldAlert className="size-5 text-danger" aria-hidden /> {L.shieldTitle}
      </h2>
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-muted">
          <ShieldCheck className="size-5 text-ok" aria-hidden /> {L.shieldNone}
        </p>
      ) : null}
      {shown.map((g) => {
        const ing = d.ingredientsById.get(g.ingredientId);
        return (
          <article
            key={`${g.ingredientId}-${g.kind}`}
            className="grid grid-cols-1 gap-3 rounded-2xl border-2 border-danger/40 bg-surface p-4 shadow-soft"
            data-testid={`shield-${g.ingredientId}-${g.kind}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="danger">{L.kinds[g.kind]}</Badge>
              <IngredientLabel ingredient={ing} className="text-lg font-bold" />
              <span className="text-sm font-semibold text-muted">{formatWeeks(g.weeks, lang)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Sparkline values={g.worst.sparkline.map((p) => p.price)} label={`${formatRp(g.worst.movingAverage, lang)} → ${formatRp(g.worst.price, lang)}`} />
              <span className="text-sm tabular-nums text-muted">
                {formatRp(g.worst.movingAverage, lang)} → <span className="font-bold text-foreground">{formatRp(g.worst.price, lang)}</span>
              </span>
            </div>
            <WhyLine>{lt(g.why)}</WhyLine>
            <div className="grid grid-cols-1 gap-2">
              {g.worst.actions.map((a) => (
                <Button
                  key={a}
                  variant={a === "menu_switch" ? "accent" : "outline"}
                  className="h-auto w-full justify-start whitespace-normal text-left"
                  onClick={() => act(a, g.ingredientId, g.weeks, g.kind)}
                  data-testid={`shield-action-${a}-${g.ingredientId}`}
                >
                  {L.shieldActions[a]}
                </Button>
              ))}
            </div>
          </article>
        );
      })}
      {groups.length > 2 ? (
        <Button variant="link" onClick={() => setAll((v) => !v)} aria-expanded={all} className="justify-self-start">
          {all ? t.common.hideDetails : t.common.seeDetails}
        </Button>
      ) : null}
    </section>
  );
}
