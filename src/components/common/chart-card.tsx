"use client";

import { useRef, useState } from "react";
import { Download, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

async function exportNodeAsPng(node: HTMLElement, fileName: string) {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(node, {
    backgroundColor: "#ffffff",
    pixelRatio: 3,
    filter: (n) => !(n instanceof HTMLElement && n.dataset.exportIgnore === "true"),
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${fileName}.png`;
  a.click();
}

/** Card for a chart: title, legend/table toggle and "Export chart as PNG" (for the poster). */
export function ChartCard({
  title,
  description,
  fileName,
  table,
  children,
  className,
  tour,
  actions,
}: {
  title: string;
  description?: string;
  fileName: string;
  table?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tour?: string;
  actions?: React.ReactNode;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const exportPng = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportNodeAsPng(ref.current, fileName);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={cn("rounded-2xl border border-border bg-surface shadow-soft", className)} data-tour={tour} aria-label={title}>
      <div ref={ref} className="rounded-2xl bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold leading-tight">{title}</h2>
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-1" data-export-ignore="true">
            {actions}
            {table ? (
              <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
                <Table2 aria-hidden /> <span className="sr-only sm:not-sr-only">{t.common.table}</span>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={exportPng} disabled={busy} data-testid={`export-${fileName}`}>
              <Download aria-hidden /> {busy ? t.common.exporting : t.common.exportPng}
            </Button>
          </div>
        </div>
        {showTable && table ? <div className="overflow-x-auto">{table}</div> : children}
      </div>
    </section>
  );
}
