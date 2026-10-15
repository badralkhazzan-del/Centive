"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { repo, useAppData } from "@/lib/repo";
import { ToastProvider, useToast } from "@/components/common/toast";
import { useT } from "@/i18n";

const HydratedContext = createContext(false);

/** True once the page is mounted and the workspace data has loaded. */
export function useHydrated() {
  return useContext(HydratedContext);
}

/**
 * Offline support (public/sw.js) runs only in production builds. In development a
 * worker left behind by an earlier production run on the same origin would answer
 * with cached chunks instead of the dev server, so it is removed along with its caches.
 */
function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => undefined);
    if ("caches" in window) {
      caches
        .keys()
        .then((names) => Promise.all(names.filter((n) => n.startsWith("piringtani-")).map((n) => caches.delete(n))))
        .catch(() => undefined);
    }
    return;
  }
  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best effort */
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const lang = useAppData().ui.lang;
  // Ready once mounted and, when signed in, once the first server load has arrived.
  const hydrated = mounted && repo.hasHydrated();

  useEffect(() => {
    repo.hydrate();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time switch after mounting
    setMounted(true);
    registerServiceWorker();
    // Workspace screens show their own loading screen, so the page can be revealed now.
    document.documentElement.removeAttribute("data-hydrating");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <HydratedContext.Provider value={hydrated}>
      <ToastProvider>
        <LiveErrors />
        {children}
      </ToastProvider>
    </HydratedContext.Provider>
  );
}

/** Tell the user when a change was refused or the server is unreachable. */
function LiveErrors() {
  const notify = useToast();
  const { t } = useT();
  const msg = useRef(t.live);
  useEffect(() => {
    msg.current = t.live;
  });
  useEffect(() => {
    let lastNetwork = 0;
    return repo.onError((kind) => {
      if (kind === "forbidden") notify(msg.current.forbidden, "info");
      else if (kind === "server") notify(msg.current.saveFailed, "info");
      else if (kind === "network" && Date.now() - lastNetwork > 30_000) {
        lastNetwork = Date.now();
        notify(msg.current.unreachable, "info");
      }
    });
  }, [notify]);
  return null;
}
