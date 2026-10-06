import type { ComponentProps } from "react";
import { Card } from "@/components";
import { cn } from "@/lib/utils";

export function ActionCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("flex-row flex-wrap items-center justify-between gap-3 p-4", className)}
      {...props}
    />
  );
}
