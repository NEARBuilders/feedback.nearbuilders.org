import { createLink } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

function TabAnchor({ className, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-4 py-3 -mb-px text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-brand-cyan data-[status=active]:text-foreground data-[current=true]:border-brand-cyan data-[current=true]:text-foreground [&>svg]:h-4 [&>svg]:w-4",
        className,
      )}
    />
  );
}

export const RouteTab = createLink(TabAnchor);

export function RouteTabs({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="flex w-full gap-1 overflow-x-auto border-b border-border">
      {children}
    </nav>
  );
}
