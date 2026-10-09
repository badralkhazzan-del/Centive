"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Database, ScrollText, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { HydrationGate } from "@/components/common/gate";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { FACTS } from "@/content/facts";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import { AuditTab } from "./audit-tab";
import { PrivacyTab } from "./privacy-tab";
import { SourcesTab } from "./sources-tab";
import { settingsStrings } from "./strings";
import { ThresholdsTab } from "./thresholds-tab";

export const SETTINGS_TABS = ["thresholds", "sources", "privacy", "audit"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const ICONS: Record<SettingsTab, LucideIcon> = {
  thresholds: SlidersHorizontal,
  sources: Database,
  privacy: ShieldCheck,
  audit: ScrollText,
};

function parseTab(raw: string | null): SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(raw ?? "") ? (raw as SettingsTab) : "thresholds";
}

function Header() {
  const { t, lang } = useT();
  return (
    <PageHeader
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <SettingsIcon className="size-4 text-primary" aria-hidden /> {t.common.appName}
        </span>
      }
      title={t.settings.title}
      subtitle={settingsStrings(lang).subtitle}
    />
  );
}

/** Shown while the search params are read on the client (Suspense fallback in page.tsx). */
export function SettingsFallback() {
  return (
    <PageContainer>
      <Header />
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-12 w-full max-w-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </PageContainer>
  );
}

function CountPill({ n, tone }: { n: number; tone: "warn" | "muted" }) {
  return (
    <span
      aria-hidden
      className={
        tone === "warn"
          ? "min-w-6 rounded-full bg-warn-soft px-1.5 text-xs leading-5 font-bold text-warn-strong tabular-nums"
          : "min-w-6 rounded-full bg-muted-surface px-1.5 text-xs leading-5 font-bold text-muted tabular-nums"
      }
    >
      {n}
    </span>
  );
}

export function SettingsView() {
  const { t, lang } = useT();
  const data = useAppData();
  const L = settingsStrings(lang);
  const params = useSearchParams();
  const raw = params.get("tab");

  // The URL is the source of truth (footer deep links), local state keeps the switch instant.
  const [state, setState] = useState(() => ({ raw, tab: parseTab(raw) }));
  if (state.raw !== raw) setState({ raw, tab: parseTab(raw) });

  const onTabChange = (value: string) => {
    const tab = parseTab(value);
    setState((s) => ({ ...s, tab }));
    const next = new URLSearchParams(params.toString());
    if (tab === "thresholds") next.delete("tab");
    else next.set("tab", tab);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const toVerify = data.ingredients.filter((i) => !i.verified).length + FACTS.filter((f) => f.buildCheck !== "confirmed").length;
  const counts: Partial<Record<SettingsTab, { n: number; tone: "warn" | "muted"; label: string }>> = {
    sources: toVerify ? { n: toVerify, tone: "warn", label: L.countToVerify(toVerify) } : undefined,
    audit: { n: data.auditLog.length, tone: "muted", label: L.entries(data.auditLog.length) },
  };

  return (
    <PageContainer>
      <Header />
      <HydrationGate>
        <Tabs value={state.tab} onValueChange={onTabChange}>
          <TabsList aria-label={t.settings.title} className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            {SETTINGS_TABS.map((key) => {
              const Icon = ICONS[key];
              const c = counts[key];
              return (
                <TabsTrigger key={key} value={key} className="min-h-11 px-3.5" data-testid={`settings-tab-${key}`}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>{t.settings.tabs[key]}</span>
                  {c ? (
                    <>
                      <CountPill n={c.n} tone={c.tone} />
                      <span className="sr-only">({c.label})</span>
                    </>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsContent value="thresholds" className="mt-5">
            <ThresholdsTab />
          </TabsContent>
          <TabsContent value="sources" className="mt-5">
            <SourcesTab />
          </TabsContent>
          <TabsContent value="privacy" className="mt-5">
            <PrivacyTab />
          </TabsContent>
          <TabsContent value="audit" className="mt-5">
            <AuditTab />
          </TabsContent>
        </Tabs>
      </HydrationGate>
    </PageContainer>
  );
}
