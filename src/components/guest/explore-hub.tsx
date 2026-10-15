"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CircleCheck, Clock, Copy, RotateCcw, Smartphone, Sparkles } from "lucide-react";
import { RoleCards } from "@/components/landing/role-cards";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { useToast } from "@/components/common/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { useT } from "@/i18n";
import { api } from "@/lib/live-client";
import { actions, repo, useAppData, useLiveUser } from "@/lib/repo";
import { roleOf } from "@/lib/repo/remote";
import { ROLE_HOME } from "@/lib/roles";

const TRY_LINKS = ["/kopdes", "/farmer", "/kitchen/switch"];

/** Home of a guest's private sample region: roles, what to try, and the phone QR code. */
export function ExploreHub() {
  const { t } = useT();
  const G = t.guest;
  const user = useLiveUser();
  const router = useRouter();
  const notify = useToast();

  // Only a guest's own copy has this page; everyone else goes to their home screen.
  useEffect(() => {
    if (!user) return;
    if (!user.guest || user.role !== "admin") {
      const role = roleOf(user);
      router.replace(role ? ROLE_HOME[role] : "/manage");
    }
  }, [user, router]);

  const reset = async () => {
    if (!window.confirm(G.resetConfirm)) return;
    await api("/api/workspace", { body: { action: "reset", start: "sample" } }).catch(() => undefined);
    await repo.refresh();
    notify(G.resetDone);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Badge variant="outline" className="gap-1.5">
            <Sparkles className="size-3.5" aria-hidden /> {G.badge}
          </Badge>
        }
        title={G.hubTitle}
        subtitle={G.hubSubtitle}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <section aria-labelledby="hub-roles" className="grid gap-3">
            <h2 id="hub-roles" className="text-xl font-bold">
              {G.rolesTitle}
            </h2>
            <RoleCards />
          </section>
          <section aria-labelledby="hub-try" className="grid gap-3">
            <h2 id="hub-try" className="text-xl font-bold">
              {G.tryTitle}
            </h2>
            <ol className="grid gap-3 md:grid-cols-3">
              {G.tries.map((item, i) => (
                <li key={item.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-soft">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="text-sm text-muted">{item.body}</p>
                  <Link
                    href={TRY_LINKS[i]}
                    className="mt-auto inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary underline-offset-4 hover:underline"
                    data-testid={`try-${i + 1}`}
                  >
                    {item.cta} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="grid content-start gap-6">
          <PhoneCard />
          <Card>
            <CardHeader>
              <CardTitle>{G.resetTitle}</CardTitle>
              <CardDescription>{G.resetBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={reset} data-testid="hub-reset">
                <RotateCcw aria-hidden /> {G.reset}
              </Button>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary-soft">
            <CardHeader>
              <CardTitle className="text-primary-strong">{G.ownTitle}</CardTitle>
              <CardDescription className="text-foreground/90">{G.ownBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/signup">
                  <Building2 aria-hidden /> {t.live.createWorkspace}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

/** QR code that opens this same copy on a phone, as one farmer. */
function PhoneCard() {
  const { t } = useT();
  const G = t.guest;
  const data = useAppData();
  const notify = useToast();
  // Default: a farmer with an offer waiting for an answer, so the phone has something to do.
  const fallback = useMemo(() => data.chat.find((m) => m.buttons && !m.answered)?.farmerId ?? data.farmers[0]?.id ?? "", [data.chat, data.farmers]);
  const [picked, setPicked] = useState<string | null>(null);
  const farmerId = picked && data.farmers.some((f) => f.id === picked) ? picked : fallback;
  const [links, setLinks] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const url = links[farmerId];
  const farmer = data.farmers.find((f) => f.id === farmerId);
  const waiting = data.chat.some((m) => m.farmerId === farmerId && m.buttons && !m.answered);

  useEffect(() => {
    if (!farmerId || links[farmerId]) return;
    let cancelled = false;
    api<{ token: string }>("/api/guest/phone", { body: { role: "farmer", entityId: farmerId } })
      .then((r) => {
        if (!cancelled) setLinks((l) => ({ ...l, [farmerId]: `${window.location.origin}/phone?t=${encodeURIComponent(r.token)}` }));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [farmerId, links]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      notify(G.phoneCopied);
    } catch {
      window.prompt(G.phoneCopy, url);
    }
  };

  return (
    <Card data-testid="phone-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" aria-hidden /> {G.phoneTitle}
        </CardTitle>
        <CardDescription>{G.phoneBody}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol className="grid gap-1.5 text-sm">
          {G.phoneSteps.map((step, i) => (
            <li key={step} className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong" aria-hidden>
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="grid gap-1.5">
          <Label htmlFor="phone-farmer">{G.phoneFarmer}</Label>
          <Select
            id="phone-farmer"
            value={farmerId}
            onChange={(e) => {
              setPicked(e.target.value);
              actions.setActiveFarmer(e.target.value);
            }}
          >
            {data.farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.displayName} · {f.village}
              </option>
            ))}
          </Select>
        </div>
        {farmer ? (
          waiting ? (
            <p className="flex items-start gap-2 rounded-xl bg-ok-soft px-3 py-2 text-sm font-semibold text-ok-strong" role="status" data-testid="phone-ready">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {G.phoneReady(farmer.displayName)}
            </p>
          ) : (
            <div className="grid gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-strong" role="status" data-testid="phone-waiting">
              <p className="flex items-start gap-2 font-semibold">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden /> {G.phoneWaiting(farmer.displayName)}
              </p>
              <Link href="/kopdes" className="inline-flex min-h-11 items-center gap-1 font-bold underline underline-offset-4">
                {G.phoneSendOffers} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          )
        ) : null}
        <div className="mx-auto flex size-52 items-center justify-center rounded-2xl border border-border bg-white p-3">
          {url ? (
            <QRCodeSVG value={url} size={180} level="M" title={G.phoneTitle} data-testid="phone-qr" />
          ) : (
            <span className="text-sm text-muted" role="status">
              {failed ? t.live.errors.server_error : t.common.loading}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copy} disabled={!url} data-testid="phone-copy">
            <Copy aria-hidden /> {G.phoneCopy}
          </Button>
          {url ? <span className="sr-only" data-testid="phone-url">{url}</span> : null}
        </div>
        <p className="text-xs text-muted">{G.phoneNote}</p>
      </CardContent>
    </Card>
  );
}
