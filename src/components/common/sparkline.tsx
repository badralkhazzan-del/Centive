/** Tiny 8-week price sparkline (SVG). The last point is the alert week. */
export function Sparkline({ values, label, className }: { values: number[]; label: string; className?: string }) {
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, h - 4 - ((v - min) / span) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className ?? "h-8 w-[120px]"} role="img" aria-label={label}>
      <path d={d} fill="none" stroke="#5b6b63" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill="#c8412d" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
}
