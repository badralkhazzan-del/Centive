"use client";

import { ExternalLink } from "lucide-react";
import type { Fact } from "@/content/facts";
import { formatDate } from "@/engines/format";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function factDate(date: string, lang: "en" | "id") {
  return date.length === 4 ? date : formatDate(date, lang, { year: true });
}

/** Visible source link for a fact from facts.ts. */
export function FactSource({ fact, className }: { fact: Fact; className?: string }) {
  const { t, lang } = useT();
  return (
    <a
      href={fact.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        className,
      )}
    >
      <span>
        {t.common.source}: {fact.sourceName} · {factDate(fact.date, lang)}
      </span>
      <ExternalLink className="size-4 shrink-0" aria-hidden />
    </a>
  );
}

/** Inline fact sentence with its source link. */
export function FactLine({ fact, className }: { fact: Fact; className?: string }) {
  const { lang } = useT();
  return (
    <p className={cn("text-sm text-muted", className)}>
      <span className="font-bold text-foreground">{lang === "id" ? (fact.valueId ?? fact.value) : fact.value}</span>{" "}
      {lang === "id" ? fact.textId : fact.textEn} <FactSource fact={fact} className="min-h-0" />
    </p>
  );
}
