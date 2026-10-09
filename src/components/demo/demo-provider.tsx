"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactLine } from "@/components/common/fact-source";
import { getFact } from "@/content/facts";
import { useT } from "@/i18n";
import { actions } from "@/lib/repo";
import { DemoContext, type DemoApi } from "./demo-context";
import { DEMO_STEPS, type DemoCtx } from "./steps";

/** Autoplay time per step (spec: 20 seconds). */
export const STEP_MS = 20_000;
const N = DEMO_STEPS.length;

type Mode = "off" | "starting" | "step" | "end";

/** Test hook: Playwright can speed the whole tour up with window.__PT_DEMO_SPEED. */
function readSpeed() {
  const v = Number((window as unknown as { __PT_DEMO_SPEED?: number }).__PT_DEMO_SPEED);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>("off");
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Camera override set by a step's timed actions; otherwise the step's own focus applies.
  const [view, setView] = useState<{ step: number; tours: string[] } | null>(null);
  const [speedState, setSpeedState] = useState(1);
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const speed = useRef(1);
  const done = useRef(new Set<string>());
  const memo = useRef<Record<string, string>>({});
  const timers = useRef<number[]>([]);
  const receivedBy = useRef("");
  const pathRef = useRef(pathname);
  useEffect(() => {
    receivedBy.current = t.kitchen.receive.receivedByDefault;
    pathRef.current = pathname;
  });

  const focus = mode === "end" ? ["regency-kpis"] : mode !== "step" ? [] : view && view.step === stepIndex ? view.tours : DEMO_STEPS[stepIndex].focus;
  const focusKey = focus.join("|");

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms / speed.current));
  };

  const ctx = useCallback(
    (live: boolean, step: number): DemoCtx => ({
      live,
      memo: memo.current,
      receivedBy: receivedBy.current,
      focus: (...tours) => setView({ step, tours }),
      go: (href) => {
        const here = pathRef.current + window.location.search;
        if (href !== here) router.push(href, { scroll: false });
      },
    }),
    [router],
  );

  /** Apply every data change of a step that has not happened yet (Next pressed early). */
  const flush = useCallback(
    (i: number) => {
      const c = ctx(false, i);
      DEMO_STEPS[i]?.actions.forEach((a, j) => {
        const key = `${i}:${j}`;
        if (a.run && !done.current.has(key)) {
          done.current.add(key);
          a.run(c);
        }
      });
    },
    [ctx],
  );

  // Enter a step: set the scene, navigate, highlight, then schedule its actions.
  useEffect(() => {
    if (mode !== "step") return;
    const step = DEMO_STEPS[stepIndex];
    const c = ctx(true, stepIndex);
    step.enter?.();
    c.go(step.href(c));
    step.actions.forEach((a, j) => {
      const key = `${stepIndex}:${j}`;
      if (a.run && done.current.has(key)) return;
      later(a.at, () => {
        const live = ctx(true, stepIndex);
        if (a.run && !done.current.has(key)) {
          done.current.add(key);
          a.run(live);
        }
        a.view?.(live);
      });
    });
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stepIndex]);

  const next = useCallback(() => {
    if (mode !== "step") return;
    clearTimers();
    flush(stepIndex);
    if (stepIndex + 1 < N) setStepIndex(stepIndex + 1);
    else setMode("end");
  }, [mode, stepIndex, flush]);

  const back = useCallback(() => {
    if (mode === "end") {
      setMode("step");
      setStepIndex(N - 1);
    } else if (mode === "step" && stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [mode, stepIndex]);

  // Autoplay: advance after STEP_MS while playing.
  useEffect(() => {
    if (mode !== "step" || !playing) return;
    const id = window.setTimeout(next, STEP_MS / speed.current);
    return () => window.clearTimeout(id);
  }, [mode, stepIndex, playing, next]);

  const start = useCallback(() => {
    clearTimers();
    speed.current = readSpeed();
    setSpeedState(speed.current);
    done.current = new Set();
    memo.current = {};
    setMode("starting");
    setView(null);
    setPlaying(true);
    actions.resetDemo();
    router.push("/", { scroll: false });
    later(900, () => {
      setStepIndex(0);
      setMode("step");
    });
  }, [router]);

  const stop = useCallback(() => {
    clearTimers();
    setMode("off");
    setView(null);
  }, []);

  // Highlight: keep data-tour-active on the current targets (pages render them late),
  // and bring the first one into the free area between the header and the card.
  useEffect(() => {
    const clear = () => document.querySelectorAll("[data-tour-active]").forEach((el) => el.removeAttribute("data-tour-active"));
    clear();
    if (!focusKey) return;
    const names = focusKey.split("|");
    let scrolled: Element | null = null;
    let settle = 0;
    const tick = () => {
      const els = names.flatMap((name) => [...document.querySelectorAll(`[data-tour="${name}"]`)]);
      document.querySelectorAll("[data-tour-active]").forEach((el) => {
        if (!els.includes(el)) el.removeAttribute("data-tour-active");
      });
      for (const el of els) if (el.getAttribute("data-tour-active") !== "true") el.setAttribute("data-tour-active", "true");
      const first = els[0];
      if (first && (first !== scrolled || settle === 2)) {
        scrollToFree(first, cardRef.current);
        scrolled = first;
      }
      if (first) settle += 1;
    };
    tick();
    const id = window.setInterval(tick, 350);
    return () => {
      window.clearInterval(id);
      clear();
    };
  }, [focusKey, pathname]);

  // Keep a spacer under the page so the last elements can scroll above the card.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || mode === "off") return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      setCardHeight(h);
      // Toasts float above the card.
      root.style.setProperty("--demo-card-h", `${Math.round(h + 8)}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--demo-card-h");
    };
  }, [mode]);

  // Escape exits; focus moves to the card when the tour starts.
  useEffect(() => {
    if (mode === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, stop]);
  useEffect(() => {
    if (mode === "step" && stepIndex === 0) titleRef.current?.focus({ preventScroll: true });
  }, [mode, stepIndex]);

  const api = useMemo<DemoApi>(() => ({ active: mode !== "off", stepIndex, start, stop }), [mode, stepIndex, start, stop]);
  const step = DEMO_STEPS[stepIndex];
  const text = t.demo.steps[stepIndex];
  const fact = step?.factId ? getFact(step.factId) : undefined;

  return (
    <DemoContext.Provider value={api}>
      {children}
      {mode !== "off" ? (
        <>
          <div aria-hidden style={{ height: cardHeight + 24 }} className="no-print" />
          <div
            ref={cardRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby="demo-card-title"
            data-testid="demo-card"
            data-mode={mode}
            data-step={mode === "step" ? stepIndex + 1 : mode === "end" ? N + 1 : 0}
            className="hide-in-poster no-print fixed inset-x-0 bottom-0 z-50 p-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[26rem] sm:p-0"
          >
            <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-accent-strong">
                  {t.demo.title}
                </span>
                {mode === "step" ? <span className="text-sm text-muted">{t.demo.stepOf(stepIndex + 1, N)}</span> : null}
                <Button variant="ghost" size="icon" className="ml-auto" onClick={stop} aria-label={t.demo.exit} data-testid="demo-exit">
                  <X aria-hidden />
                </Button>
              </div>
              <ol className="grid grid-cols-8 gap-1" aria-hidden>
                {DEMO_STEPS.map((_, i) => (
                  <li key={i} className="h-1.5 overflow-hidden rounded-full bg-muted-surface">
                    {mode === "end" || (mode === "step" && i < stepIndex) ? <span className="block h-full w-full bg-primary" /> : null}
                    {mode === "step" && i === stepIndex ? (
                      <span
                        key={stepIndex}
                        className="demo-progress block h-full bg-primary"
                        style={{ animationDuration: `${STEP_MS / speedState}ms`, animationPlayState: playing ? "running" : "paused" }}
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
              <div aria-live="polite" className="grid gap-1.5">
                {mode === "starting" ? (
                  <h2 id="demo-card-title" className="text-lg font-bold">
                    {t.demo.starting}
                  </h2>
                ) : mode === "end" ? (
                  <>
                    <h2 id="demo-card-title" className="text-xl font-extrabold text-primary-strong" data-testid="demo-end">
                      {t.demo.endTitle}
                    </h2>
                    <p className="text-base">{t.demo.endBody}</p>
                  </>
                ) : (
                  <>
                    <h2 id="demo-card-title" ref={titleRef} tabIndex={-1} className="text-lg font-bold leading-snug focus:outline-none">
                      {text.title}
                    </h2>
                    <p className="text-base">{text.body}</p>
                    {fact ? <FactLine fact={fact} /> : null}
                  </>
                )}
              </div>
              {mode === "end" ? (
                <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
                  <Button variant="outline" size="icon" onClick={back} aria-label={t.common.back} data-testid="demo-back">
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button variant="outline" onClick={start} data-testid="demo-restart">
                    <RotateCcw aria-hidden /> {t.demo.restart}
                  </Button>
                  <Button onClick={stop} data-testid="demo-finish">
                    {t.demo.finish}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-[auto_1fr_auto] gap-2">
                  <Button variant="outline" onClick={back} disabled={mode !== "step" || stepIndex === 0} data-testid="demo-back">
                    <ChevronLeft aria-hidden /> <span className="sr-only sm:not-sr-only">{t.common.back}</span>
                  </Button>
                  <Button variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={mode !== "step"} aria-pressed={!playing} data-testid="demo-pause">
                    {playing ? <Pause aria-hidden /> : <Play aria-hidden />} {playing ? t.demo.pause : t.demo.autoplay}
                  </Button>
                  <Button onClick={next} disabled={mode !== "step"} data-testid="demo-next">
                    {stepIndex === N - 1 ? t.demo.finish : t.common.next} <ChevronRight aria-hidden />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </DemoContext.Provider>
  );
}

function scrollToFree(el: Element, card: HTMLElement | null) {
  const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const bottom = card ? card.getBoundingClientRect().top : window.innerHeight;
  const top = Math.max(0, header);
  const avail = bottom - top;
  const r = el.getBoundingClientRect();
  const want = r.height + 24 < avail ? top + (avail - r.height) / 2 : top + 12;
  const delta = r.top - want;
  if (Math.abs(delta) < 8) return;
  window.scrollBy({ top: delta, behavior: reducedMotion() ? "auto" : "smooth" });
}
