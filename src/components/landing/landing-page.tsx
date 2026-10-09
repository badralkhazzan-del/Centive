"use client";

import { ChartColumn, Play, Shuffle, Store } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/components/demo/demo-context";
import { useT } from "@/i18n";
import { LoopDiagram } from "./loop-diagram";
import { RoleCards } from "./role-cards";
import { StatCards } from "./stat-cards";

export function LandingPage() {
  const { t } = useT();
  const demo = useDemo();
  const pillars = [
    { key: "forecast", Icon: ChartColumn, accent: false, ...t.landing.pillars.forecast },
    { key: "board", Icon: Store, accent: false, ...t.landing.pillars.board },
    { key: "switch", Icon: Shuffle, accent: true, ...t.landing.pillars.switch },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-leaf-soft via-background to-background" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div className="flex flex-col gap-5">
            <p className="text-sm font-bold uppercase tracking-wide text-primary">{t.landing.eyebrow}</p>
            <div className="flex items-center gap-4">
              <LogoMark className="size-16 sm:size-20" title="PiringTani" />
              <h1 className="text-5xl font-extrabold tracking-tight text-primary-strong sm:text-6xl">
                Piring<span className="text-[#4f7a1f]">Tani</span>
              </h1>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground sm:text-3xl">{t.common.tagline}</p>
              <p className="text-xl font-semibold italic text-muted sm:text-2xl" lang="id">
                {t.common.taglineId}
              </p>
            </div>
            <p className="max-w-xl text-lg text-foreground/90">{t.landing.heroTitle}</p>
            <p className="max-w-xl text-base text-muted">{t.landing.heroBody}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button size="lg" variant="accent" onClick={demo.start} data-testid="hero-play-demo" className="hide-in-poster">
                <Play aria-hidden /> {t.common.playDemo}
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#roles">{t.landing.chooseRole}</a>
              </Button>
            </div>
          </div>
          <div id="roles" className="flex scroll-mt-24 flex-col gap-3">
            <div>
              <h2 className="text-xl font-bold">{t.landing.chooseRole}</h2>
              <p className="text-sm text-muted">{t.landing.chooseRoleHint}</p>
            </div>
            <RoleCards />
          </div>
        </div>
      </section>

      {/* Problem in numbers */}
      <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="problem-title">
        <h2 id="problem-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.landing.problemTitle}
        </h2>
        <p className="mb-6 mt-1 text-muted">{t.landing.problemIntro}</p>
        <StatCards />
        <p className="mt-3 text-sm text-muted">{t.landing.problemNote}</p>
      </section>

      {/* Three core features */}
      <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.landing.pillarsTitle}
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {pillars.map((p, i) => (
            <li
              key={p.key}
              className={
                p.accent
                  ? "rounded-2xl border-2 border-accent bg-accent-soft p-6"
                  : "rounded-2xl border border-border bg-surface p-6 shadow-soft"
              }
            >
              <div className="mb-3 flex items-center gap-3">
                <span className={p.accent ? "flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground" : "flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary"}>
                  <p.Icon className="size-6" aria-hidden />
                </span>
                <span className="text-sm font-bold text-muted">0{i + 1}</span>
              </div>
              <h3 className="text-lg font-bold">{p.title}</h3>
              <p className="mt-1 text-base text-muted">{p.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">{t.landing.supporting}</p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.landing.howTitle}
        </h2>
        <p className="mb-4 mt-1 text-muted">{t.landing.howIntro}</p>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-8">
          <LoopDiagram />
        </div>
      </section>

      {/* Complements, not competes */}
      <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="complements-title">
        <div className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-10">
          <h2 id="complements-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.landing.complementsTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-white/90">{t.landing.complementsBody}</p>
        </div>
      </section>
    </div>
  );
}
