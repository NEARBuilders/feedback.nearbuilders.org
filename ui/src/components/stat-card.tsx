import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A labelled value in a bordered tile. Used for compact key-fact grids. */
export function StatCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-card p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-base font-bold leading-tight text-foreground", mono && "font-mono")}>
        {value}
      </div>
    </div>
  );
}
