"use client";

import Link from "next/link";
import {
  Activity,
  CodeXml,
  FlaskConical,
  Flag,
  HandHeart,
  PackageCheck,
  Play,
  Sprout,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { useDemo } from "@/components/demo/demo-context";
import { PageContainer } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/i18n";

// One icon per success metric, in the order of t.about.metrics:
// local sourcing share, fill rate, forecast accuracy (MAPE), days to farmer payment, price volatility.
const METRIC_ICONS: LucideIcon[] = [Sprout, PackageCheck, Target, Wallet, Activity];

function CardIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
      <Icon className="size-6" aria-hidden />
    </span>
  );
}

export function AboutPage() {
  const { t } = useT();
  const demo = useDemo();
  const cards: { key: string; Icon: LucideIcon; title: string; body: string }[] = [
    { key: "free", Icon: HandHeart, title: t.about.freeTitle, body: t.about.freeBody },
    { key: "scale", Icon: TrendingUp, title: t.about.scaleTitle, body: t.about.scaleBody },
  ];

  return (
    <div className="relative" data-testid="about-page">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-leaf-soft via-background to-background" />
      <PageContainer className="max-w-5xl space-y-10 sm:space-y-12">
        {/* Intro */}
        <header className="space-y-6 pt-2 sm:pt-6">
          <div className="flex items-start gap-4 sm:items-center">
            <LogoMark className="size-14 shrink-0 sm:size-16" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold uppercase tracking-wide text-primary">{t.common.poweredBy}</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-primary-strong sm:text-4xl">{t.about.title}</h1>
              <p className="text-lg text-muted">{t.about.subtitle}</p>
            </div>
          </div>
          <div className="space-y-1 rounded-2xl border border-border border-l-4 border-l-primary bg-surface px-5 py-4 shadow-soft">
            <p className="text-xl font-bold text-foreground sm:text-2xl" lang="en">
              {t.common.tagline}
            </p>
            <p className="text-lg font-semibold italic text-muted sm:text-xl" lang="id">
              {t.common.taglineId}
            </p>
          </div>
        </header>

        {/* Free for farmers, at scale, pilot plan (with its success metrics) */}
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ key, Icon, title, body }) => (
            <Card key={key} data-testid={`about-${key}`}>
              <section aria-labelledby={`about-${key}-title`} className="flex h-full flex-col gap-3 p-6">
                <CardIcon Icon={Icon} />
                <h2 id={`about-${key}-title`} className="text-xl font-bold leading-tight text-foreground">
                  {title}
                </h2>
                <p className="text-base leading-relaxed text-foreground/85">{body}</p>
              </section>
            </Card>
          ))}

          <Card className="md:col-span-2" data-testid="about-pilot">
            <section
              aria-labelledby="about-pilot-title"
              className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-8"
            >
              <div className="flex flex-col gap-3">
                <CardIcon Icon={Flag} />
                <h2 id="about-pilot-title" className="text-xl font-bold leading-tight text-foreground">
                  {t.about.pilotTitle}
                </h2>
                <p className="text-lg font-semibold leading-relaxed text-foreground">{t.about.pilotBody}</p>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                <h3 id="about-metrics-title" className="text-base font-bold text-foreground">
                  {t.about.metricsTitle}
                </h3>
                <ul className="flex flex-wrap gap-2.5" aria-labelledby="about-metrics-title" data-testid="about-metrics">
                  {t.about.metrics.map((m, i) => {
                    const Icon = METRIC_ICONS[i] ?? Target;
                    return (
                      <li
                        key={m}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-4 py-2 text-base font-semibold text-primary-strong"
                      >
                        <Icon className="size-5 shrink-0" aria-hidden />
                        {m}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </Card>
        </div>

        {/* Tech note */}
        <section
          aria-labelledby="about-tech-title"
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong bg-muted-surface p-5 sm:flex-row sm:items-start sm:gap-4 sm:p-6"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
            <CodeXml className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 id="about-tech-title" className="text-lg font-bold">
              {t.about.techTitle}
            </h2>
            <p className="max-w-3xl text-base text-muted">{t.about.techBody}</p>
          </div>
        </section>

        {/* Developer */}
        <section aria-labelledby="about-dev-title" className="rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6" data-testid="about-developer">
          <h2 id="about-dev-title" className="text-lg font-bold">
            {t.about.developerTitle}
          </h2>
          <p className="max-w-3xl text-base text-muted">{t.about.developerBody}</p>
        </section>

        {/* Next steps */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" variant="accent" onClick={demo.start}>
            <Play aria-hidden /> {t.common.playDemo}
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/simulation">
              <FlaskConical className="text-primary" aria-hidden /> {t.common.simulationLab}
            </Link>
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
