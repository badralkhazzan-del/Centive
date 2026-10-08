"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { repo, useAppData } from "@/lib/repo";
import { ToastProvider } from "@/components/common/toast";

const HydratedContext = createContext(false);

/** True once the saved demo data has been loaded from this browser. */
export function useHydrated() {
  return useContext(HydratedContext);
}

function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best effort */
    });
  });
  if (document.readyState === "complete") {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
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
