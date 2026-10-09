"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { repo, useAppData } from "@/lib/repo";
import { ToastProvider } from "@/components/common/toast";

const HydratedContext = createContext(false);

/** True once the saved demo data has been loaded from this browser. */
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
  const [hydrated, setHydrated] = useState(false);
  const lang = useAppData().ui.lang;

  useEffect(() => {
    repo.hydrate();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time switch after client-only storage loads
    setHydrated(true);
    document.documentElement.removeAttribute("data-hydrating");
    registerServiceWorker();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <HydratedContext.Provider value={hydrated}>
      <ToastProvider>{children}</ToastProvider>
    </HydratedContext.Provider>
  );
}
