"use client";

import { ChartColumn, ClipboardList, MessageCircle, QrCode, Shuffle, Sprout, Store, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n";

// "How it works": the planning loop. Pure SVG so it can be exported for the poster.
// Ring: Menu -> Forecast -> Kopdes -> Farmers -> Delivery & QR -> Feedback -> Menu.
// Branch: Kopdes -> Menu Switch -> Menu (turmeric).

interface NodeSpec {
  key: "menu" | "forecast" | "kopdes" | "farmers" | "delivery" | "feedback" | "switch";
  x: number;
  y: number;
  Icon: LucideIcon;
}

const W = 186;
const H = 74;

const NODES: NodeSpec[] = [
  { key: "menu", x: 150, y: 110, Icon: ClipboardList },
  { key: "forecast", x: 400, y: 66, Icon: ChartColumn },
  { key: "kopdes", x: 650, y: 110, Icon: Store },
  { key: "farmers", x: 650, y: 330, Icon: Sprout },
  { key: "delivery", x: 400, y: 374, Icon: QrCode },
  { key: "feedback", x: 150, y: 330, Icon: MessageCircle },
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

export function LoopDiagram() {
  const { t } = useT();
  const L = t.landing.loop;
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
        aria-label={`${L.menu} → ${L.forecast} → ${L.kopdes} → ${L.farmers} → ${L.delivery} → ${L.feedback} → ${L.menu}. ${L.switch}: ${L.kopdes} → ${L.menu}.`}
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
      <figcaption className="mt-3 text-center text-sm text-muted">{L.caption}</figcaption>
    </figure>
  );
}
