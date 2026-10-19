"use client";

import { ChartColumn, ClipboardList, MessageCircle, QrCode, Shuffle, Sprout, Store, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n";

// "How it works": the planning loop. Pure SVG so it can be exported for the poster.
// Ring (green, solid, numbered 1 to 6, every week): Menu -> Forecast -> Kopdes -> Farmers ->
// Delivery & QR -> Feedback -> Menu.
// Detour (turmeric, dashed, only when supply is short or a price spikes): Kopdes -> Menu Switch -> Menu.
// Words on the dashed arrows, an "only if needed" tag and a legend under the ring (plain page text,
// so it stays readable on phones) say what the two kinds of arrow mean.

interface NodeSpec {
  key: "menu" | "forecast" | "kopdes" | "farmers" | "delivery" | "feedback" | "switch";
  /** Position in the weekly ring (1 to 6); the Menu Switch is a detour and has none. */
  step?: number;
  x: number;
  y: number;
  Icon: LucideIcon;
}

const W = 186;
const H = 74;

const NODES: NodeSpec[] = [
  { key: "menu", step: 1, x: 150, y: 110, Icon: ClipboardList },
  { key: "forecast", step: 2, x: 400, y: 66, Icon: ChartColumn },
  { key: "kopdes", step: 3, x: 650, y: 110, Icon: Store },
  { key: "farmers", step: 4, x: 650, y: 330, Icon: Sprout },
  { key: "delivery", step: 5, x: 400, y: 374, Icon: QrCode },
  { key: "feedback", step: 6, x: 150, y: 330, Icon: MessageCircle },
  { key: "switch", x: 400, y: 220, Icon: Shuffle },
];

const RING = [
  "M246 96 Q 272 66 304 66",
  "M496 66 Q 528 66 556 96",
  "M694 148 Q 722 220 694 292",
  "M556 344 Q 528 374 496 374",
  "M304 374 Q 272 374 246 344",
  "M106 292 Q 78 220 106 148",
];

const BRANCH = ["M606 148 Q 560 206 496 216", "M304 216 Q 240 206 194 148"];

/** Text with a paper-colored halo, so it stays readable where it crosses the background rings. */
const HALO = { stroke: "#ffffff", strokeWidth: 5, paintOrder: "stroke", strokeLinejoin: "round" } as const;

export function LoopDiagram() {
  const { t } = useT();
  const L = t.landing.loop;
  const pillW = Math.max(124, L.onlyIfNeeded.length * 9 + 32);
  const label: Record<NodeSpec["key"], [string, string]> = {
    menu: [L.menu, L.menuSub],
    forecast: [L.forecast, L.forecastSub],
    kopdes: [L.kopdes, L.kopdesSub],
    farmers: [L.farmers, L.farmersSub],
    delivery: [L.delivery, L.deliverySub],
    feedback: [L.feedback, L.feedbackSub],
    switch: [L.switch, L.switchSub],
  };

  return (
    <figure className="w-full">
      <svg
        viewBox="0 0 800 444"
        className="h-auto w-full"
        role="img"
        aria-label={`${L.legendWeekly}: ${L.menu} → ${L.forecast} → ${L.kopdes} → ${L.farmers} → ${L.delivery} → ${L.feedback} → ${L.menu}. ${L.legendDetour}: ${L.kopdes} → ${L.switch} → ${L.menu}. ${L.legendDetourDetail}`}
        fontFamily="var(--font-jakarta), system-ui, sans-serif"
      >
        <defs>
          <marker id="pt-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#1f6f4a" />
          </marker>
          <marker id="pt-arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#c98a0c" />
          </marker>
        </defs>

        {/* soft field rows in the background */}
        <ellipse cx="400" cy="220" rx="330" ry="170" fill="#eef6e2" opacity="0.7" />
        <ellipse cx="400" cy="220" rx="250" ry="118" fill="none" stroke="#7fb241" strokeOpacity="0.25" strokeWidth="2" />

        {RING.map((d, i) => (
          <g key={d}>
            <path d={d} fill="none" stroke="#1f6f4a" strokeWidth="3" markerEnd="url(#pt-arrow)" opacity="0.85" />
            <path d={d} fill="none" stroke="#7fb241" strokeWidth="3" className="loop-flow" style={{ animationDelay: `${i * 0.2}s` }} />
          </g>
        ))}
        {BRANCH.map((d) => (
          <path key={d} d={d} fill="none" stroke="#c98a0c" strokeWidth="3" strokeDasharray="7 6" markerEnd="url(#pt-arrow-accent)" />
        ))}

        {/* what the two dashed arrows mean, written next to them */}
        <g fontSize="14" fontWeight="700" fill="#8a5a00" aria-hidden {...HALO}>
          <text x="504" y="240">{L.switchTrigger[0]}</text>
          <text x="504" y="257">{L.switchTrigger[1]}</text>
          <text x="296" y="240" textAnchor="end">{L.switchReturn[0]}</text>
          <text x="296" y="257" textAnchor="end">{L.switchReturn[1]}</text>
        </g>
        <g fontSize="14" fontWeight="700" fill="#8a5a00">
          <text x="504" y="240">{L.switchTrigger[0]}</text>
          <text x="504" y="257">{L.switchTrigger[1]}</text>
          <text x="296" y="240" textAnchor="end">{L.switchReturn[0]}</text>
          <text x="296" y="257" textAnchor="end">{L.switchReturn[1]}</text>
        </g>
        <g transform="translate(400 164)">
          <rect x={-pillW / 2} y="-13" width={pillW} height="26" rx="13" fill="#e3a21a" />
          <text textAnchor="middle" y="5" fontSize="12" fontWeight="800" fill="#1e2a24" letterSpacing="0.8">
            {L.onlyIfNeeded}
          </text>
        </g>

        {NODES.map((n) => {
          const isSwitch = n.key === "switch";
          const [title, sub] = label[n.key];
          return (
            <g key={n.key} transform={`translate(${n.x - W / 2} ${n.y - H / 2})`}>
              <rect
                width={W}
                height={H}
                rx="18"
                fill={isSwitch ? "#fbf0d4" : "#ffffff"}
                stroke={isSwitch ? "#e3a21a" : "#1f6f4a"}
                strokeWidth={isSwitch ? 3 : 2}
              />
              {isSwitch ? <rect width={W} height={H} rx="18" fill="none" stroke="#e3a21a" strokeWidth="6" className="loop-pulse" opacity="0.35" /> : null}
              <circle cx="31" cy={H / 2} r="19" fill={isSwitch ? "#e3a21a" : "#e3f0e8"} />
              <n.Icon x={19} y={H / 2 - 12} width={24} height={24} color={isSwitch ? "#1e2a24" : "#1f6f4a"} strokeWidth={2.2} aria-hidden />
              {n.step ? (
                <g>
                  <circle cx="14" cy="15" r="12" fill="#1f6f4a" stroke="#ffffff" strokeWidth="2.5" />
                  <text x="14" y="20" textAnchor="middle" fontSize="14" fontWeight="800" fill="#ffffff">
                    {n.step}
                  </text>
                </g>
              ) : null}
              <text x="58" y={H / 2 - 4} fontSize="16" fontWeight="800" fill="#1e2a24">
                {title}
              </text>
              <text x="58" y={H / 2 + 16} fontSize="13" fontWeight="600" fill="#5b6b63">
                {sub}
              </text>
            </g>
          );
        })}

      </svg>
      <ul className="mx-auto -mt-2 grid max-w-4xl gap-3 sm:grid-cols-2 sm:gap-4" data-testid="loop-legend">
        <li className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 sm:p-4">
          <svg viewBox="0 0 56 16" className="mt-1.5 w-14 shrink-0" aria-hidden>
            <path d="M2 8 H40" stroke="#1f6f4a" strokeWidth="3" />
            <path d="M38 2 L52 8 L38 14 Z" fill="#1f6f4a" />
          </svg>
          <div>
            <p className="font-bold text-primary-strong sm:text-lg">{L.legendWeekly}</p>
            <p className="text-sm text-foreground sm:text-base">{L.legendWeeklyDetail}</p>
          </div>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-accent/50 bg-accent-soft p-3 sm:p-4">
          <svg viewBox="0 0 56 16" className="mt-1.5 w-14 shrink-0" aria-hidden>
            <path d="M2 8 H38" stroke="#c98a0c" strokeWidth="3" strokeDasharray="6 5" />
            <path d="M38 2 L52 8 L38 14 Z" fill="#c98a0c" />
          </svg>
          <div>
            <p className="font-bold text-accent-strong sm:text-lg">{L.legendDetour}</p>
            <p className="text-sm text-foreground sm:text-base">{L.legendDetourDetail}</p>
          </div>
        </li>
      </ul>
      <figcaption className="mt-4 text-center text-sm text-muted">{L.caption}</figcaption>
    </figure>
  );
}
