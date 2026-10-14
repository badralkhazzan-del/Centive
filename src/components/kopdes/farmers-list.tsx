"use client";

import { useSearchParams } from "next/navigation";
import { MessageCircle, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FactLine } from "@/components/common/fact-source";
import { IngredientLabel } from "@/components/common/ingredient";
import { getFact } from "@/content/facts";
import { formatNumber, formatPct } from "@/engines/format";
import { heldByFarmer } from "@/engines/matching";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { KopdesShell } from "./kopdes-shell";

function ShareBar({ label, value }: { label: string; value: number }) {
  const { lang } = useT();
  return (
    <div className="grid grid-cols-1 gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="text-lg font-bold tabular-nums">{formatPct(value, lang)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted-surface">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export function FarmersList() {
  const { t, lang } = useT();
  const d = useDerived();
  const params = useSearchParams();
  const filter = params.get("ingredient");
  const kd = d.kopdesById.get(d.data.ui.activeKopdesId)!;
  const inc = d.inclusionByKopdes.get(kd.id)!;
  const weeks = d.windowWeeks;
  const L = t.kopdes.farmers;
  const farmers = kd.memberFarmerIds
    .map((id) => d.farmersById.get(id)!)
    .filter((f) => !filter || f.commodities.some((c) => c.ingredientId === filter))
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  const consented = kd.memberFarmerIds.filter((id) => d.farmersById.get(id)?.consentGiven).length;

  return (
    <KopdesShell title={L.title} subtitle={L.subtitle}>
      <div className="grid grid-cols-1 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{L.inclusionTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            <ShareBar label={L.womenShare} value={inc.womenPct} />
            <ShareBar label={L.youthShare} value={inc.youthPct} />
            <p className="text-sm text-muted">{L.inclusionNote}</p>
            <FactLine fact={getFact("brazil-45")} />
            <p className="text-sm text-muted">{L.fairness(formatPct(d.data.settings.fairnessCapPct, lang))}</p>
            <FactLine fact={getFact("min-15-suppliers")} />
            <p className="text-sm text-muted">{t.settings.consentCount(consented, kd.memberFarmerIds.length)}</p>
          </CardContent>
        </Card>
        {filter ? (
          <p className="text-sm text-muted">
            <IngredientLabel ingredient={d.ingredientsById.get(filter)} className="font-semibold text-foreground" /> · {farmers.length} / {kd.memberFarmerIds.length}
          </p>
        ) : null}
        <ul className="grid grid-cols-1 gap-3">
          {farmers.map((f) => (
            <li key={f.id} className="rounded-2xl border border-border bg-surface p-4 shadow-soft" data-testid={`farmer-${f.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">{f.displayName}</span>
                <span className="text-sm text-muted">{f.village}</span>
                <span className="ml-auto flex gap-1">
                  <Badge variant="muted">{f.gender === "female" ? L.female : L.male}</Badge>
                  {f.ageGroup === "youth" ? <Badge variant="accent">{L.youth}</Badge> : null}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  {L.reliability}: <span className="font-bold tabular-nums">{formatPct(f.reliabilityScore, lang)}</span>
                </span>
                <span className={cn("inline-flex items-center gap-1 font-semibold", f.consentGiven ? "text-ok-strong" : "text-warn-strong")}>
                  {f.consentGiven ? <ShieldCheck className="size-4" aria-hidden /> : <ShieldQuestion className="size-4" aria-hidden />}
                  {f.consentGiven ? L.consentGiven : L.consentPending}
                </span>
                <span className="text-muted">{f.phoneMasked}</span>
                {f.phone ? <WhatsAppOffer farmerId={f.id} phone={f.phone} /> : null}
              </div>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="py-1 font-semibold">{t.trace.ingredient}</th>
                    <th scope="col" className="py-1 text-right font-semibold">{L.capacity}</th>
                    <th scope="col" className="py-1 text-right font-semibold">{L.commitments}</th>
                  </tr>
                </thead>
                <tbody>
                  {f.commodities.map((c) => {
                    const held = heldByFarmer(d.data.commitments, f.id, c.ingredientId, weeks, undefined, false);
                    return (
                      <tr key={c.ingredientId} className={cn("border-t border-border", filter === c.ingredientId && "bg-primary-soft/60")}>
                        <th scope="row" className="py-1.5 text-left font-normal">
                          <IngredientLabel ingredient={d.ingredientsById.get(c.ingredientId)} />
                        </th>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatNumber(c.weeklyCapacityKg, lang)} kg{t.common.perWeek}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {held > 0 ? `${formatNumber(held, lang)} kg` : "–"}
                          <span className="ml-1 text-xs text-muted">
                            ({formatNumber(Math.max(0, c.weeklyCapacityKg - held), lang)} {L.spare})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </li>
          ))}
        </ul>
      </div>
    </KopdesShell>
  );
}

/** Opens WhatsApp to the farmer with their latest open offer and a link to answer it here. */
function WhatsAppOffer({ farmerId, phone }: { farmerId: string; phone: string }) {
  const { t } = useT();
  const d = useDerived();
  const f = d.farmersById.get(farmerId);
  const open = [...d.data.chat].reverse().find((m) => m.farmerId === farmerId && m.buttons?.length && !m.answered);
  const greeting = `Halo ${f?.gender === "female" ? "Bu" : "Pak"} ${f?.displayName ?? ""}`;
  const body = open ? open.textId.replace(/\*\*/g, "*") : `${greeting} 👋`;
  const url = typeof window !== "undefined" ? `${window.location.origin}/farmer` : "/farmer";
  const text = `${body}\n\nJawab di PiringTani: ${url}`;
  return (
    <a
      href={whatsappLink(text, phone)}
      target="_blank"
      rel="noopener noreferrer"
      title={t.kopdes.farmers.whatsappHint}
      className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      data-testid={`whatsapp-${farmerId}`}
    >
      <MessageCircle className="size-4" aria-hidden /> {open ? t.kopdes.farmers.whatsappOffer : t.kopdes.farmers.whatsapp}
    </a>
  );
}
