import type { MetadataRoute } from "next";
import { en } from "@/i18n/en";

// Makes PiringTani installable as an app (Chrome and Edge on Windows, Mac and
// Android; Safari via Add to Home Screen or Add to Dock). The app is the website
// itself, so every update reaches installed copies at once.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PiringTani",
    short_name: "PiringTani",
    description: en.meta.description,
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#faf8f3",
    theme_color: "#1f6f4a",
    categories: ["food", "productivity", "government"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Sample region", short_name: "Sample", url: "/explore", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Commitment Board (Kopdes)", short_name: "Kopdes", url: "/kopdes", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Kitchen (SPPG)", short_name: "Kitchen", url: "/kitchen", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Farmer inbox", short_name: "Farmer", url: "/farmer", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
    ],
    screenshots: [
      { src: "/screenshots/wide.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "Sample region home with the farmer's phone QR code" },
      { src: "/screenshots/narrow.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Kopdes Commitment Board on a phone" },
    ],
  };
}
