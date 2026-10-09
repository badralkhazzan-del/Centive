"use client";

import { Ban, Eye, Handshake, HardDrive, IdCard, ScrollText, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/common/status";
import { formatPct } from "@/engines/format";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { shortKopdesName } from "@/lib/names";
import { IconTile } from "./parts";
import { settingsStrings } from "./strings";

const POINT_ICONS = [IdCard, Handshake, Eye, ScrollText, HardDrive];

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted-surface"
    >
      <div className="h-full rounded-full bg-ok" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function PrivacyTab() {
  const { t, lang } = useT();
  const d = useDerived();
  const L = settingsStrings(lang);
  const S = t.settings;
  const farmers = d.data.farmers;
  const consented = farmers.filter((f) => f.consentGiven).length;
  const sample = farmers.find((f) => f.id === d.data.ui.activeFarmerId) ?? farmers[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h2 className="sr-only">{S.tabs.privacy}</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <IconTile icon={ShieldCheck} />
            {L.privacyTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2" data-testid="privacy-points">
            {S.privacyPoints.map((p, i) => {
              const Icon = POINT_ICONS[i] ?? ShieldCheck;
              return (
                <li key={p} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ok-soft text-ok-strong">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="pt-1.5 text-base leading-snug">{p}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconTile icon={Handshake} />
              {L.consentTitle}
            </CardTitle>
            <CardDescription>{L.consentHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tabular-nums text-foreground">{consented}</span>
                <span className="text-lg font-bold text-muted">/ {farmers.length}</span>
              </p>
              <p className="font-semibold" data-testid="consent-count">
                {S.consentCount(consented, farmers.length)}
              </p>
              <Bar value={farmers.length ? consented / farmers.length : 0} label={L.consentTitle} />
            </div>
            <div className="grid gap-2">
              <h3 className="text-sm font-bold text-muted">{L.byKopdes}</h3>
              <ul className="grid gap-3">
                {d.data.kopdes.map((k) => {
                  const members = farmers.filter((f) => f.kopdesId === k.id);
                  const yes = members.filter((f) => f.consentGiven).length;
                  const share = members.length ? yes / members.length : 0;
                  const name = shortKopdesName(k.name);
                  return (
                    <li key={k.id} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold">{name}</span>
                        <span className="tabular-nums text-muted">
                          {yes}/{members.length} · {formatPct(share, lang)}
                        </span>
                      </div>
                      <Bar value={share} label={`${L.consentTitle}: ${name}`} />
                    </li>
                  );
                })}
              </ul>
            </div>
          </CardContent>
        </Card>

        {sample ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <IconTile icon={UserRound} />
                {L.sampleTitle}
              </CardTitle>
              <CardDescription>{L.sampleHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid divide-y divide-border rounded-xl border border-border" data-testid="sample-farmer">
                {[
                  [
                    L.firstName,
                    <span key="n" className="font-bold">
                      {sample.displayName}
                    </span>,
                  ],
                  [L.village, sample.village],
                  [
                    L.phone,
                    <span key="p" className="font-mono">
                      {sample.phoneMasked}
                    </span>,
                  ],
                  [
                    L.nik,
                    <span key="k" className="inline-flex items-center gap-1.5 font-semibold text-ok-strong">
                      <Ban className="size-4" aria-hidden /> {L.notCollected}
                    </span>,
                  ],
                  [
                    L.consent,
                    sample.consentGiven ? (
                      <StatusPill key="c" status="green" label={t.kopdes.farmers.consentGiven} size="sm" />
                    ) : (
                      <StatusPill key="c" status="yellow" label={t.kopdes.farmers.consentPending} size="sm" />
                    ),
                  ],
                ].map(([k, v], i) => (
                  <div key={i} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                    <dt className="text-sm text-muted">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
