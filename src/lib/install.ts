"use client";

import { useSyncExternalStore } from "react";

// Installing PiringTani as an app. Chrome and Edge (Windows, Mac, Android) fire
// `beforeinstallprompt`; the boot script in the page head keeps that event in
// window.__ptInstall so a button can show the browser's own install dialog later.
// Safari has no such event: iPhone and iPad use Share > Add to Home Screen, and Safari
// on a Mac uses File > Add to Dock, so for those the app shows the steps instead.

export type InstallKind = "installed" | "prompt" | "ios" | "mac" | "none";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallWindow = Window & { __ptInstall?: InstallPromptEvent | null; __ptInstalled?: boolean };

const EVENT = "pt-install";

function detect(): InstallKind {
  const w = window as InstallWindow;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone || w.__ptInstalled) return "installed";
  if (w.__ptInstall) return "prompt";
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || touchMac) return "ios";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(ua)) return "mac";
  return "none";
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    mq?.removeEventListener?.("change", cb);
  };
}

/** How this browser can install the app ("none" during server rendering and where it cannot). */
export function useInstallKind(): InstallKind {
  return useSyncExternalStore(subscribe, detect, () => "none");
}

/** Shows the browser's install dialog (Chrome and Edge). Returns true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const w = window as InstallWindow;
  const e = w.__ptInstall;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  // The event can be used only once.
  w.__ptInstall = null;
  if (outcome === "accepted") w.__ptInstalled = true;
  window.dispatchEvent(new Event(EVENT));
  return outcome === "accepted";
}

/** Runs in the page head, before React: keeps the install event for later. */
export const INSTALL_BOOT = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__ptInstall=e;window.dispatchEvent(new Event('${EVENT}'))});window.addEventListener('appinstalled',function(){window.__ptInstall=null;window.__ptInstalled=true;window.dispatchEvent(new Event('${EVENT}'))});`;
