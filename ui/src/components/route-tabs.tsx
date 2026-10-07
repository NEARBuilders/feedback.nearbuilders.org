import { createLink } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

function TabAnchor({ className, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[current=true]:bg-foreground data-[current=true]:text-background data-[status=active]:bg-foreground data-[status=active]:text-background [&>svg]:h-3.5 [&>svg]:w-3.5",
        className,
      )}
    />
  );
}

export const RouteTab = createLink(TabAnchor);

export function RouteTabs({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-border bg-card p-0.5 [scrollbar-width:none]"
    >
      {children}
    </nav>
  );
}
