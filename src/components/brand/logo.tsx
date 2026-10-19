import { cn } from "@/lib/utils";

/** PiringTani mark: a plate seen from above with a sprouting leaf. Original artwork. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-10", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {/* The plate is drawn around (24, 28.5); this centers it in the square, with room for the leaves. */}
      <g transform="translate(24 24) scale(0.88) translate(-24 -28.5)">
        <circle cx="24" cy="28.5" r="17" fill="#e3f0e8" stroke="#1f6f4a" strokeWidth="3" />
        <ellipse cx="24" cy="31" rx="10.5" ry="4.2" fill="none" stroke="#1f6f4a" strokeWidth="1.8" opacity="0.45" />
        <path d="M24 31V17.5" stroke="#1f6f4a" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M24 22.5c-6.8.4-10.6-3.7-10.4-9.6 6.2-.3 10.2 3.4 10.4 9.6Z" fill="#7fb241" />
        <path d="M24 19.5c.3-6.5 4.3-10.6 11-10.5.1 6.3-4.1 10.4-11 10.5Z" fill="#1f6f4a" />
        <circle cx="24" cy="31" r="1.9" fill="#e3a21a" />
      </g>
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={compact ? "size-8" : "size-10"} />
      <span className={cn("font-extrabold tracking-tight text-primary-strong", compact ? "text-lg" : "text-xl")}>
        Piring<span className="text-[#4f7a1f]">Tani</span>
      </span>
    </span>
  );
}
