import { cn } from "@/lib/utils";

/** An empty plate seen from above with a small sprout. Original artwork, decorative. */
export function EmptyPlate({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("size-28", className)} aria-hidden>
      <circle cx="60" cy="60" r="58" fill="#eef6e2" />
      {/* fork */}
      <path d="M14 34v9a4 4 0 0 0 8 0v-9M18 34v13M18 47v33" fill="none" stroke="#1f6f4a" strokeWidth="2.6" strokeLinecap="round" opacity="0.6" />
      {/* spoon */}
      <ellipse cx="102" cy="42" rx="4.6" ry="7.5" fill="none" stroke="#1f6f4a" strokeWidth="2.6" opacity="0.6" />
      <path d="M102 49.5V80" stroke="#1f6f4a" strokeWidth="2.6" strokeLinecap="round" opacity="0.6" />
      {/* plate */}
      <circle cx="60" cy="62" r="31" fill="#ffffff" stroke="#1f6f4a" strokeWidth="3.5" />
      <circle cx="60" cy="62" r="21" fill="none" stroke="#1f6f4a" strokeWidth="1.8" opacity="0.28" />
      {/* sprout */}
      <ellipse cx="60" cy="74.5" rx="7" ry="2" fill="#1f6f4a" opacity="0.18" />
      <path d="M60 74V58" stroke="#1f6f4a" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M60 64c-7.5.4-11.7-4.1-11.4-10.6 6.8-.3 11.2 3.7 11.4 10.6Z" fill="#7fb241" />
      <path d="M60 61c.3-7.2 4.7-11.7 12.1-11.6.1 6.9-4.5 11.4-12.1 11.6Z" fill="#1f6f4a" />
      <circle cx="60" cy="74" r="1.8" fill="#e3a21a" />
    </svg>
  );
}

/**
 * Centered, friendly full-page message used by the not-found page and the error boundary.
 * The badge icon always comes with the text title, so meaning never relies on color.
 */
export function StatusScreen({
  eyebrow,
  badge,
  tone = "primary",
  title,
  body,
  actions,
  live = false,
  children,
  testId,
}: {
  eyebrow?: React.ReactNode;
  badge: React.ReactNode;
  tone?: "primary" | "danger";
  title: React.ReactNode;
  body: React.ReactNode;
  actions?: React.ReactNode;
  /** Announce the title and body to screen readers when the screen appears. */
  live?: boolean;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12" data-testid={testId}>
      <section className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface px-5 py-10 text-center shadow-soft sm:px-10 sm:py-14">
        <div className="relative">
          <EmptyPlate className="size-28 sm:size-32" />
          <span
            className={cn(
              "absolute -bottom-1 -right-1 flex size-11 items-center justify-center rounded-full ring-4 ring-surface [&_svg]:size-5",
              tone === "danger" ? "bg-danger-soft text-danger-strong" : "bg-primary text-primary-foreground",
            )}
            aria-hidden
          >
            {badge}
          </span>
        </div>
        <div className="space-y-2" role={live ? "alert" : undefined}>
          {eyebrow ? <p className="text-sm font-bold uppercase tracking-wide text-primary">{eyebrow}</p> : null}
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="mx-auto max-w-md text-lg text-muted">{body}</p>
        </div>
        {actions ? <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">{actions}</div> : null}
      </section>
      {children}
    </div>
  );
}
