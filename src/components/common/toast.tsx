"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CircleCheck, Info, X } from "lucide-react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info";
}

const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const close = useT().t.common.close;
  const notify = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="hide-in-poster pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-base shadow-lg animate-in fade-in-0 slide-in-from-bottom-2",
              t.tone === "success" ? "border-ok/30 bg-surface" : "border-border bg-surface",
            )}
          >
            {t.tone === "success" ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden /> : <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />}
            <span className="flex-1">{t.text}</span>
            <button
              type="button"
              className="-my-2.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              aria-label={close}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
