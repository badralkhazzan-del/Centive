"use client";

import { FactSource } from "@/components/common/fact-source";
import { getFact, LANDING_FACT_IDS } from "@/content/facts";
import { useT } from "@/i18n";

export function StatCards() {
  const { lang } = useT();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {LANDING_FACT_IDS.map((id, i) => {
        const f = getFact(id);
        return (
          <li
            key={id}
            data-tour={i === 0 ? "stat-kopdes" : undefined}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 shadow-soft"
          >
            <span className="text-3xl font-extrabold tracking-tight text-primary-strong">{lang === "id" ? (f.valueId ?? f.value) : f.value}</span>
            <span className="text-base text-foreground">{lang === "id" ? f.textId : f.textEn}</span>
            <FactSource fact={f} className="mt-auto" />
          </li>
        );
      })}
    </ul>
  );
}
