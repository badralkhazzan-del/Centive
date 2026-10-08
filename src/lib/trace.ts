import type { Batch, Farmer } from "@/types";

// The QR label links to /trace/<code>?d=<payload>. The payload carries the public
// batch details (first names and village only), so a phone that scans the label
// can show the trace page even though the demo data lives in another browser.

export interface TracePayload {
  i: string; // ingredient id
  kg: number;
  g: "A" | "B";
  h: string; // harvest date
  f: [string, string][]; // [first name, village]
  kd: string; // kopdes id
  kt: string; // kitchen id
  c: boolean; // cold chain checked
  p: string; // planned delivery date
}

function toBase64Url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeTrace(batch: Batch, farmers: Map<string, Farmer>): string {
  const payload: TracePayload = {
    i: batch.ingredientId,
    kg: batch.kg,
    g: batch.grade,
    h: batch.harvestDate,
    f: batch.farmerIds.map((id) => farmers.get(id)).filter(Boolean).map((f) => [f!.displayName, f!.village]),
    kd: batch.kopdesId,
    kt: batch.kitchenId,
    c: batch.coldChainChecked,
    p: batch.plannedDeliveryDate,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeTrace(s: string | null | undefined): TracePayload | null {
  if (!s) return null;
  try {
    const p = JSON.parse(fromBase64Url(s)) as TracePayload;
    if (typeof p.i !== "string" || typeof p.kg !== "number" || !Array.isArray(p.f)) return null;
    return p;
  } catch {
    return null;
  }
}

export function traceUrl(origin: string, batch: Batch, farmers: Map<string, Farmer>) {
  return `${origin}/trace/${batch.id}?d=${encodeTrace(batch, farmers)}`;
}
