"use client";

import {
  BookOpen,
  CalendarDays,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  FileWarning,
  Newspaper,
  Tag,
  TriangleAlert,
  Users,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { IngredientLabel } from "@/components/common/ingredient";
import { factDate, FactSource } from "@/components/common/fact-source";
import { FACTS, getFact } from "@/content/facts";
import { DEMO_CALENDAR } from "@/data/places";
import { formatDate, formatNumber, formatPct } from "@/engines/format";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { IconTile, ScrollTable, TD, TH } from "./parts";
import { settingsStrings } from "./strings";

type StatusKind = "verified" | "toVerify" | "placeholder" | "fictional" | "demo";

/** Status is always icon + label, never color alone. */
export function SourceStatus({ kind, label }: { kind: StatusKind; label: string }) {
  const map = {
    verified: { variant: "green", Icon: CircleCheck },
    toVerify: { variant: "yellow", Icon: TriangleAlert },
    placeholder: { variant: "accent", Icon: FileWarning },
    fictional: { variant: "muted", Icon: CircleDashed },
    demo: { variant: "outline", Icon: CalendarDays },
  } as const;
  const { variant, Icon } = map[kind];
  return (
    <Badge variant={variant} data-status={kind}>
      <Icon aria-hidden /> {label}
    </Badge>
  );
}

function ExtLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-lg font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        className,
      )}
    >
      <span>{children}</span>
      <ExternalLink className="size-4 shrink-0" aria-hidden />
    </a>
  );
}

function SectionHeading({ id, icon, title, count }: { id: string; icon: LucideIcon; title: string; count?: React.ReactNode }) {
  return (
    <h2 id={id} className="flex flex-wrap items-center gap-2.5 text-lg leading-tight font-bold">
      <IconTile icon={icon} />
      {title}
      {count}
    </h2>
  );
}

export function SourcesTab() {
  const { t, lang, nm } = useT();
  const data = useAppData();
  const L = settingsStrings(lang);
  const S = t.settings;

  const factsConfirmed = FACTS.filter((f) => f.buildCheck === "confirmed").length;
  const factsOpen = FACTS.length - factsConfirmed;
  const unverified = data.ingredients.filter((i) => !i.verified);
  const verifiedCount = data.ingredients.length - unverified.length;
  const pihps = data.prices.filter((p) => p.source === "PIHPS").length;
  const placeholders = data.prices.length - pihps;
  const budget = getFact("raw-food-budget");
  const holidayText = DEMO_CALENDAR.holidays.map((h) => `${formatDate(h.date, lang, { year: true })}, ${nm(h)}`).join("; ");

  const counts = (ok: number, open: number) => (
    <span className="flex flex-wrap gap-1.5">
      {ok > 0 ? <SourceStatus kind="verified" label={L.countVerified(ok)} /> : null}
      {open > 0 ? <SourceStatus kind="toVerify" label={L.countToVerify(open)} /> : null}
    </span>
  );

  const datasets: { key: string; icon: LucideIcon; name: string; source: React.ReactNode; status: React.ReactNode }[] = [
    {
      key: "facts",
      icon: Newspaper,
      name: S.datasets.facts,
      source: (
        <a
          href="#facts"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          {L.factsSource(FACTS.length)}
        </a>
      ),
      status: counts(factsConfirmed, factsOpen),
    },
    {
      key: "tkpi",
      icon: Wheat,
      name: S.datasets.tkpi,
      source: (
        <span className="grid">
          <span>{L.tkpiSource}</span>
          <ExtLink href="https://www.panganku.org">panganku.org</ExtLink>
        </span>
      ),
      status: counts(verifiedCount, unverified.length),
    },
    {
      key: "prices",
      icon: Tag,
      name: S.datasets.prices,
      source: (
        <span className="grid">
          <span>{L.pricesSource}</span>
          <ExtLink href="https://www.bi.go.id/hargapangan">PIHPS · bi.go.id/hargapangan</ExtLink>
          <span className="text-xs text-muted">
            {placeholders > 0 ? L.pricesPlaceholder(placeholders) : null}
            {placeholders > 0 && pihps > 0 ? " · " : null}
            {pihps > 0 ? L.pricesPihps(pihps) : null}
          </span>
        </span>
      ),
      status: (
        <span className="flex flex-wrap gap-1.5">
          {placeholders > 0 ? <SourceStatus kind="placeholder" label={S.placeholder} /> : null}
          {pihps > 0 ? <SourceStatus kind="verified" label={`PIHPS`} /> : null}
        </span>
      ),
    },
    {
      key: "people",
      icon: Users,
      name: S.datasets.people,
      source: <span>{L.peopleSource}</span>,
      status: <SourceStatus kind="fictional" label={S.fictional} />,
    },
    {
      key: "calendar",
      icon: CalendarDays,
      name: S.datasets.calendar,
      source: <span>{L.calendarSource(holidayText)}</span>,
      status: <SourceStatus kind="demo" label={t.common.demoData} />,
    },
    {
      key: "budget",
      icon: Wallet,
      name: S.datasets.budget,
      source: (
        <span className="grid">
          <span>
            <span className="font-bold">{lang === "id" ? (budget.valueId ?? budget.value) : budget.value}</span> · {L.budgetSource}
          </span>
          <FactSource fact={budget} />
        </span>
      ),
      status: (
        <SourceStatus kind={budget.buildCheck === "confirmed" ? "verified" : "toVerify"} label={budget.buildCheck === "confirmed" ? S.verified : S.toVerify} />
      ),
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <p className="max-w-3xl text-base text-muted">{S.sourcesIntro}</p>

      <Card>
        <CardHeader>
          <SectionHeading id="datasets" icon={BookOpen} title={L.datasetsTitle} />
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm" data-testid="datasets-table">
            <caption className="sr-only">{L.datasetsTitle}</caption>
            <thead className="max-sm:sr-only">
              <tr className="border-b border-border">
                <th scope="col" className={cn(TH, "sm:w-[30%]")}>
                  {S.dataset}
                </th>
                <th scope="col" className={TH}>
                  {t.common.source}
                </th>
                <th scope="col" className={cn(TH, "sm:w-52")}>
                  {S.status}
                </th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0 max-sm:grid max-sm:gap-1 max-sm:py-3" data-testid={`dataset-${row.key}`}>
                  <th scope="row" className={cn(TD, "text-left font-semibold max-sm:p-0")}>
                    <span className="flex items-start gap-2">
                      <row.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {row.name}
                    </span>
                  </th>
                  <td className={cn(TD, "text-muted max-sm:p-0 max-sm:pl-6")}>{row.source}</td>
                  <td className={cn(TD, "max-sm:p-0 max-sm:pl-6")}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading id="facts" icon={Newspaper} title={L.factsTitle} count={counts(factsConfirmed, factsOpen)} />
          <CardDescription>{L.factsHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid md:hidden" aria-label={L.factsTitle} data-testid="facts-list">
            {FACTS.map((f) => (
              <li key={f.id} className="grid gap-1.5 border-b border-border py-3 first:pt-0 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-extrabold text-foreground">{lang === "id" ? (f.valueId ?? f.value) : f.value}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{factDate(f.date, lang)}</span>
                </div>
                <p className="text-sm">{lang === "id" ? f.textId : f.textEn}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ExtLink href={f.sourceUrl} className="text-sm">
                    {f.sourceName}
                  </ExtLink>
                  <SourceStatus
                    kind={f.buildCheck === "confirmed" ? "verified" : "toVerify"}
                    label={f.buildCheck === "confirmed" ? L.confirmedCheck : L.checkLink}
                  />
                </div>
                {f.buildCheckNote ? (
                  <p lang="en" className="text-xs text-muted">
                    {f.buildCheckNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <ScrollTable label={L.factsTitle} className="hidden md:block">
            <table className="w-full min-w-[820px] text-sm" data-testid="facts-table">
              <caption className="sr-only">{L.factsTitle}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={cn(TH, "w-36")}>
                    {L.value}
                  </th>
                  <th scope="col" className={TH}>
                    {L.fact}
                  </th>
                  <th scope="col" className={cn(TH, "w-48")}>
                    {t.common.source}
                  </th>
                  <th scope="col" className={cn(TH, "w-28")}>
                    {L.date}
                  </th>
                  <th scope="col" className={cn(TH, "w-56")}>
                    {L.check}
                  </th>
                </tr>
              </thead>
              <tbody>
                {FACTS.map((f) => (
                  <tr key={f.id} id={`fact-${f.id}`} className="border-b border-border last:border-0" data-testid={`fact-row-${f.id}`}>
                    <th scope="row" className={cn(TD, "text-left font-extrabold whitespace-nowrap text-foreground")}>
                      {lang === "id" ? (f.valueId ?? f.value) : f.value}
                    </th>
                    <td className={TD}>{lang === "id" ? f.textId : f.textEn}</td>
                    <td className={cn(TD, "py-0")}>
                      <ExtLink href={f.sourceUrl}>{f.sourceName}</ExtLink>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{factDate(f.date, lang)}</td>
                    <td className={TD}>
                      <div className="grid gap-1">
                        <span>
                          <SourceStatus
                            kind={f.buildCheck === "confirmed" ? "verified" : "toVerify"}
                            label={f.buildCheck === "confirmed" ? L.confirmedCheck : L.checkLink}
                          />
                        </span>
                        {f.buildCheckNote ? (
                          <span lang="en" className="text-xs text-muted">
                            {f.buildCheckNote}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </CardContent>
      </Card>

      <Card className={unverified.length ? "border-warn/50" : undefined}>
        <CardHeader>
          <SectionHeading
            id="unverified"
            icon={TriangleAlert}
            title={S.unverifiedTitle}
            count={unverified.length ? <SourceStatus kind="toVerify" label={L.countToVerify(unverified.length)} /> : null}
          />
          <CardDescription>{S.unverifiedHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {unverified.length === 0 ? (
            <p className="flex items-center gap-2 font-semibold text-ok-strong">
              <CircleCheck className="size-5" aria-hidden /> {L.allVerified}
            </p>
          ) : (
            <>
              <ul className="grid md:hidden" aria-label={S.unverifiedTitle} data-testid="unverified-list">
                {unverified.map((ing) => (
                  <li key={ing.id} className="grid gap-2 border-b border-border py-3 first:pt-0 last:border-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <IngredientLabel ingredient={ing} className="font-semibold" />
                      <span className="text-sm text-muted italic" lang="id">
                        {ing.tkpiName}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted-surface p-2.5 text-sm">
                      {[
                        [S.kcal, formatNumber(ing.energyKcalPer100g, lang)],
                        [S.proteinG, formatNumber(ing.proteinGPer100g, lang, 1)],
                        [S.bdd, formatPct(ing.edibleFraction, lang)],
                      ].map(([k, v]) => (
                        <div key={k} className="grid">
                          <dt className="text-xs text-muted">{k}</dt>
                          <dd className="font-bold tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xs text-muted">
                      {t.common.source}: {ing.dataSource}
                      {ing.dataNote ? (
                        <>
                          {" · "}
                          <span lang="en">{ing.dataNote}</span>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
              <ScrollTable label={S.unverifiedTitle} className="hidden md:block">
                <table className="w-full min-w-[900px] text-sm" data-testid="unverified-table">
                  <caption className="sr-only">{S.unverifiedTitle}</caption>
                  <thead>
                    <tr>
                      <th scope="col" rowSpan={2} className={cn(TH, "align-bottom")}>
                        {L.ingredient}
                      </th>
                      <th scope="col" rowSpan={2} className={cn(TH, "align-bottom")}>
                        {L.tkpiRow}
                      </th>
                      <th scope="colgroup" colSpan={2} className={cn(TH, "border-b border-border pb-1 text-center")}>
                        {S.nutritionTable}
                      </th>
                      <th scope="col" rowSpan={2} className={cn(TH, "text-right align-bottom")}>
                        {S.bdd}
                      </th>
                      <th scope="col" rowSpan={2} className={cn(TH, "align-bottom")}>
                        {t.common.source}
                      </th>
                      <th scope="col" rowSpan={2} className={cn(TH, "align-bottom")}>
                        {L.note}
                      </th>
                    </tr>
                    <tr className="border-b border-border">
                      <th scope="col" className={cn(TH, "pt-1 text-right")}>
                        {S.kcal}
                      </th>
                      <th scope="col" className={cn(TH, "pt-1 text-right")}>
                        {S.proteinG}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {unverified.map((ing) => (
                      <tr key={ing.id} className="border-b border-border last:border-0" data-testid={`unverified-${ing.id}`}>
                        <th scope="row" className={cn(TD, "text-left font-semibold whitespace-nowrap")}>
                          <IngredientLabel ingredient={ing} />
                        </th>
                        <td className={cn(TD, "italic")} lang="id">
                          {ing.tkpiName}
                        </td>
                        <td className={cn(TD, "text-right tabular-nums")}>{formatNumber(ing.energyKcalPer100g, lang)}</td>
                        <td className={cn(TD, "text-right tabular-nums")}>{formatNumber(ing.proteinGPer100g, lang, 1)}</td>
                        <td className={cn(TD, "text-right tabular-nums")}>{formatPct(ing.edibleFraction, lang)}</td>
                        <td className={cn(TD, "whitespace-nowrap")}>{ing.dataSource}</td>
                        <td className={cn(TD, "max-w-80 text-muted")} lang="en">
                          {ing.dataNote ?? "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
