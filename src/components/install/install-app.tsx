"use client";

import { useState } from "react";
import { CircleCheck, Download, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n";
import { promptInstall, useInstallKind } from "@/lib/install";
import { cn } from "@/lib/utils";

/**
 * Install support for any button or menu item: `available` says whether to show it,
 * `install()` opens the browser's dialog or the Safari steps, and `dialog` must be rendered.
 */
export function useInstallApp() {
  const { t } = useT();
  const kind = useInstallKind();
  const [steps, setSteps] = useState<"ios" | "mac" | null>(null);
  const install = () => {
    if (kind === "prompt") void promptInstall();
    else if (kind === "ios" || kind === "mac") setSteps(kind);
  };
  const list = steps === "mac" ? t.install.macSteps : t.install.iosSteps;
  const dialog = (
    <Dialog open={steps !== null} onOpenChange={(open) => !open && setSteps(null)}>
      <DialogContent closeLabel={t.common.close} data-testid="install-steps">
        <DialogHeader>
          <DialogTitle>{steps === "mac" ? t.install.macTitle : t.install.iosTitle}</DialogTitle>
          <DialogDescription>{t.install.body}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2">
          {list.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-strong" aria-hidden>
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <Button onClick={() => setSteps(null)} className="justify-self-start">
          {t.install.done}
        </Button>
      </DialogContent>
    </Dialog>
  );
  return { kind, available: kind === "prompt" || kind === "ios" || kind === "mac", install, dialog };
}

/** "Install the app" button; hidden where the browser cannot install apps. */
export function InstallAppButton({ className, variant = "outline", size = "lg" }: { className?: string; variant?: "outline" | "default"; size?: "lg" | "sm" | "default" }) {
  const { t } = useT();
  const { available, install, dialog } = useInstallApp();
  if (!available) return null;
  return (
    <>
      <Button variant={variant} size={size} onClick={install} className={className} data-testid="install-app">
        <Download aria-hidden /> {t.install.button}
      </Button>
      {dialog}
    </>
  );
}

/** A card for the sample region home: install, or a note that it is installed. */
export function InstallAppCard({ className }: { className?: string }) {
  const { t } = useT();
  const { kind, available, install, dialog } = useInstallApp();
  if (!available && kind !== "installed") return null;
  return (
    <section className={cn("grid gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft", className)} aria-labelledby="install-title" data-testid="install-card">
      <h2 id="install-title" className="flex items-center gap-2 text-lg font-bold">
        <MonitorSmartphone className="size-5 text-primary" aria-hidden /> {t.install.title}
      </h2>
      {kind === "installed" ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-ok-strong">
          <CircleCheck className="size-4" aria-hidden /> {t.install.installed}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">{t.install.body}</p>
          <Button variant="outline" onClick={install} className="justify-self-start" data-testid="install-card-button">
            <Download aria-hidden /> {t.install.button}
          </Button>
          {dialog}
        </>
      )}
    </section>
  );
}
