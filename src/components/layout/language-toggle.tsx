"use client";

import { actions } from "@/lib/repo";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Lang } from "@/types";

export function LanguageToggle({ className }: { className?: string }) {
  const { t, lang } = useT();
  const options: { value: Lang; short: string; label: string }[] = [
    { value: "en", short: "EN", label: t.common.english },
    { value: "id", short: "ID", label: t.common.indonesian },
  ];
  const other = options.find((o) => o.value !== lang)!;
  return (
    <>
      <button
        type="button"
        onClick={() => actions.setLang(other.value)}
        aria-label={`${options.find((o) => o.value === lang)!.short} · ${t.common.language}: ${other.label}`}
        data-testid="lang-toggle-compact"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring sm:hidden"
      >
        <span aria-hidden>{options.find((o) => o.value === lang)!.short}</span>
      </button>
    <div role="group" aria-label={t.common.language} className={cn("hidden rounded-xl border border-border bg-surface p-0.5 sm:inline-flex", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={lang === o.value}
          aria-label={`${o.short} · ${o.label}`}
          onClick={() => actions.setLang(o.value)}
          data-testid={`lang-${o.value}`}
          className={cn(
            "min-h-10 min-w-11 rounded-[10px] px-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
            lang === o.value ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {o.short}
        </button>
      ))}
    </div>
    </>
  );
}
