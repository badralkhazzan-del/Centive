"use client";

import { useT } from "@/i18n";

export function SkipLink() {
  const { t } = useT();
  return (
    <a
      href="#main"
      className="sr-only z-50 min-h-11 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
    >
      {t.common.skipToContent}
    </a>
  );
}
