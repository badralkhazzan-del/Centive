"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { useT } from "@/i18n";
import { useAppData, useLiveMode } from "@/lib/repo";

export function AppFooter() {
  const { t } = useT();
  const live = useLiveMode();
  const data = useAppData();
  // Real workspaces hold real data; the fictional-data notice applies to the demo and the sample region.
  const fictional = !live || Boolean(data.workspace?.sample);
  return (
    <>
      <footer className="hide-in-poster mt-16 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-muted md:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-3">
            <LogoMark className="size-9 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{t.footer.team}</p>
              <p>{t.footer.competition}</p>
              {fictional ? (
                <p>
                  <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-strong">{t.common.demoData}</span>
                  <span data-testid="footer-fictional">{t.common.fictional}</span>
                </p>
              ) : (
                <p data-testid="footer-live">{data.workspace?.name}{data.workspace?.region ? ` · ${data.workspace.region}` : ""}</p>
              )}
            </div>
          </div>
          <nav aria-label={t.common.footerNav} className="grid grid-cols-2 gap-x-5 font-semibold sm:flex sm:flex-wrap sm:items-start">
            <Link className="inline-flex min-h-11 min-w-11 items-center hover:text-foreground" href="/settings?tab=sources">{t.footer.dataSources}</Link>
            <Link className="inline-flex min-h-11 min-w-11 items-center hover:text-foreground" href="/settings?tab=privacy">{t.footer.privacy}</Link>
            <Link className="inline-flex min-h-11 min-w-11 items-center hover:text-foreground" href="/about">{t.common.about}</Link>
            <Link className="inline-flex min-h-11 min-w-11 items-center hover:text-foreground" href="/simulation">{t.common.simulationLab}</Link>
          </nav>
        </div>
      </footer>
      {fictional ? (
        <p className="show-in-poster fixed bottom-2 right-3 text-xs font-semibold text-muted">
          {t.common.demoData} · {t.common.fictional}
        </p>
      ) : null}
    </>
  );
}
