"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { useT } from "@/i18n";

export function AppFooter() {
  const { t } = useT();
  return (
    <>
      <footer className="hide-in-poster mt-16 border-t border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-muted md:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-3">
            <LogoMark className="size-9 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{t.footer.team}</p>
              <p>{t.footer.competition}</p>
              <p>
                <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-strong">{t.common.demoData}</span>
                <span data-testid="footer-fictional">{t.common.fictional}</span>
              </p>
            </div>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-5 gap-y-2 font-semibold">
            <Link className="min-h-11 py-2 hover:text-foreground" href="/settings?tab=sources">{t.footer.dataSources}</Link>
            <Link className="min-h-11 py-2 hover:text-foreground" href="/settings?tab=privacy">{t.footer.privacy}</Link>
            <Link className="min-h-11 py-2 hover:text-foreground" href="/about">{t.common.about}</Link>
            <Link className="min-h-11 py-2 hover:text-foreground" href="/simulation">{t.common.simulationLab}</Link>
          </nav>
        </div>
      </footer>
      <p className="show-in-poster fixed bottom-2 right-3 text-xs font-semibold text-muted">
        {t.common.demoData} · {t.common.fictional}
      </p>
    </>
  );
}
