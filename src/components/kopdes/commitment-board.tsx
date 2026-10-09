"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, Shuffle, Sparkles, Store, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IngredientLabel } from "@/components/common/ingredient";
import { ProgressBar, StatusPill, type StatusKind } from "@/components/common/status";
import { useToast } from "@/components/common/toast";
import { formatDateRange, formatNumber, formatPct } from "@/engines/format";
import { weekRange } from "@/engines/derive";
import { useT } from "@/i18n";
import { actions, useDerived } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { KopdesShell } from "./kopdes-shell";
import { PriceShieldPanel } from "./price-shield";

const ORDER: Record<StatusKind, number> = { red: 0, yellow: 1, surplus: 2, green: 3, none: 4 };

export function CommitmentBoard() {
  const { t, lang } = useT();
  const d = useDerived();
  const [all, setAll] = useState(false);
  const kopdesId = d.data.ui.activeKopdesId;
  const weeks = d.windowWeeks;
  const range = formatDateRange(weekRange(d.today, weeks[0]).start, weekRange(d.today, weeks[weeks.length - 1]).end, lang);
  const items = (d.kopdesCommodities.get(kopdesId) ?? [])
    .map((id) => ({ id, cell: d.windowCoverage(kopdesId, id, weeks) }))
    .filter((x) => x.cell.needed > 0)
    .sort((a, b) => ORDER[a.cell.status] - ORDER[b.cell.status] || a.cell.pct - b.cell.pct);
  const shown = all ? items : items.slice(0, 4);

  return (
    <KopdesShell
      title={t.kopdes.board.title}
      subtitle={
        <>
          <p className="font-semibold text-foreground">{t.kopdes.board.window(weeks[0], weeks[weeks.length - 1], range)}</p>
          <p className="text-sm">{t.kopdes.board.leadNote}</p>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6">
        <section className="grid grid-cols-1 gap-4" aria-label={t.kopdes.board.title}>
          {shown.map((x) => (
            <BoardCard key={x.id} ingredientId={x.id} />
          ))}
          {items.length > 4 ? (
            <Button variant="outline" onClick={() => setAll((v) => !v)} aria-expanded={all} data-testid="board-show-all">
              {all ? t.kopdes.board.showLess : t.kopdes.board.showAll(items.length)}
            </Button>
          ) : null}
        </section>
        <PriceShieldPanel />
      </div>
    </KopdesShell>
  );
}

export function BoardCard({ ingredientId, live = false }: { ingredientId: string; live?: boolean }) {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const notify = useToast();
  const kopdesId = d.data.ui.activeKopdesId;
  const weeks = d.windowWeeks;
  const ing = d.ingredientsById.get(ingredientId)!;
  const cell = d.windowCoverage(kopdesId, ingredientId, weeks);
  const perWeek = weeks.map((w) => ({ w, c: d.coverage(kopdesId, ingredientId, w) }));
  const band = d.commitmentBand(ingredientId);
  const surplus = ing.seasonal && perWeek.some((p) => p.c.needed > 0 && p.c.pct >= d.data.settings.substitution.surplusThreshold);
  const status: StatusKind = cell.status;
  const n = weeks.length;
  const L = t.kopdes.board;
  const gapWeeks = perWeek.filter((p) => p.c.needed > 0 && p.c.pct < 1).map((p) => p.w);

  const sendOffers = () => {
    const r = actions.sendOffers(kopdesId, ingredientId);
    notify(r.created.length || r.offerWeeks.length ? L.offersSent(r.created.length, `${formatNumber(r.created.reduce((s, c) => s + c.kgPerWeek, 0), lang)} kg`) : L.noGap, "info");
  };
  const invite = () => {
    const r = actions.inviteMoreFarmers(kopdesId, ingredientId);
    notify(`${r.invited.length ? L.invited(r.invited.length) + " " : ""}${L.offersSent(r.created.length, `${formatNumber(r.created.reduce((s, c) => s + c.kgPerWeek, 0), lang)} kg`)}`, "info");
  };
  const neighbor = () => {
    const r = actions.requestNeighbor(kopdesId, ingredientId);
    notify(L.offersSent(r.created.length, `${formatNumber(r.created.reduce((s, c) => s + c.kgPerWeek, 0), lang)} kg`), "info");
  };
  const menuSwitch = () => {
    actions.requestMenuSwitch(kopdesId, ingredientId, gapWeeks.length ? gapWeeks : weeks);
    notify(L.switchRequested);
  };

  return (
    <article
      className={cn(
        "grid grid-cols-1 gap-3 rounded-2xl border bg-surface p-4 shadow-soft",
        status === "red" ? "border-danger/40" : status === "yellow" ? "border-warn/60" : "border-border",
      )}
      data-testid={`board-card-${ingredientId}`}
      data-tour={`board-${ingredientId}`}
      data-coverage={Math.round(cell.pct * 100)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2>
          <IngredientLabel ingredient={ing} className="text-xl font-bold" />
        </h2>
        <StatusPill status={status} label={`${t.status[status]} · ${formatPct(cell.pct, lang)}`} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-base">
        <div>
          <dt className="text-sm text-muted">{L.needed}</dt>
          <dd className="font-bold tabular-nums">
            {formatNumber(cell.needed / n, lang)} kg<span className="text-sm font-normal text-muted">{t.common.perWeek}</span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{L.committed}</dt>
          <dd className="font-bold tabular-nums" data-testid={`committed-${ingredientId}`}>
            {formatNumber(cell.committed / n, lang)} kg<span className="text-sm font-normal text-muted">{t.common.perWeek}</span>
          </dd>
        </div>
      </dl>
      <ProgressBar
        pct={cell.pct}
        offeredPct={cell.offeredPct}
        status={status}
        label={`${nm(ing)}: ${formatPct(cell.pct, lang)}`}
        testId={`bar-${ingredientId}`}
        className={live ? "h-5" : undefined}
      />
      {cell.offered > 0 ? (
        <p className="text-sm text-muted">
          <span className="striped mr-1.5 inline-block size-3 rounded-sm bg-warn align-middle" aria-hidden />
          {L.offered}: {formatNumber(cell.offered / n, lang)} kg{t.common.perWeek}
        </p>
      ) : null}
      <ul className="grid grid-cols-4 gap-1.5" aria-label={L.weeksNeeded}>
        {perWeek.map(({ w, c }) => (
          <li key={w} className="flex flex-col items-center gap-0.5 rounded-lg bg-muted-surface py-1">
            <span className="text-xs font-bold text-muted">{L.weekChip(w)}</span>
            {c.needed > 0 ? <StatusPill status={c.status} size="sm" label={formatPct(c.pct, lang)} /> : <span className="text-xs text-muted">–</span>}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        <span className="text-muted">{L.band}: </span>
        <span className="font-bold tabular-nums">
          Rp {formatNumber(band.floor, lang)} – {formatNumber(band.ceiling, lang)}
          {t.common.perKg}
        </span>
      </p>
      {surplus ? (
        <p className="flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2 text-sm font-semibold text-ok-strong">
          <Sparkles className="size-4" aria-hidden /> {L.surplusHint}
        </p>
      ) : null}
      {!live ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={sendOffers} disabled={cell.pct >= 1} className="h-auto whitespace-normal py-2 text-center" data-testid={`send-offers-${ingredientId}`} data-tour={`send-offers-${ingredientId}`}>
            <Send aria-hidden /> {L.sendOffers}
          </Button>
          <Button variant="outline" className="h-auto whitespace-normal py-2 text-center" asChild>
            <Link href={`/kopdes/farmers?ingredient=${ingredientId}`}>
              <Users aria-hidden /> {L.seeFarmers}
            </Link>
          </Button>
        </div>
      ) : null}
      {!live && status === "red" ? (
        <div className="grid grid-cols-1 gap-2 border-t border-border pt-3" data-testid={`ladder-${ingredientId}`}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{L.ladderTitle}</h3>
          <Button variant="outline" className="h-auto justify-start whitespace-normal text-left" onClick={invite}>
            <UserPlus aria-hidden /> <span className="text-muted">a.</span> {L.ladderA}
          </Button>
          <Button variant="outline" className="h-auto justify-start whitespace-normal text-left" onClick={neighbor}>
            <Store aria-hidden /> <span className="text-muted">b.</span> {L.ladderB}
          </Button>
          <Button variant="accent" className="h-auto justify-start whitespace-normal text-left" onClick={menuSwitch} data-testid={`ladder-switch-${ingredientId}`}>
            <Shuffle aria-hidden /> <span>c.</span> {L.ladderC}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
