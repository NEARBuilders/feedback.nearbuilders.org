import type { ReactNode } from "react";

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned content, e.g. a badge or date. */
  trailing?: ReactNode;
  /** Extra detail below the title row. */
  children?: ReactNode;
}

/** Bordered row for lighter lists; the compact counterpart to the rounds table. */
export function ListRow({ title, subtitle, trailing, children }: ListRowProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}
