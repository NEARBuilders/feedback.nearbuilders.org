import { Star } from "lucide-react";
import type { ComponentProps } from "react";
import { Badge } from "@/components";

export function StarBadge(props: ComponentProps<typeof Badge>) {
  return (
    <Badge variant="secondary" className="gap-1 text-[10px]" {...props}>
      <Star className="h-3 w-3 fill-current" />
      standout
    </Badge>
  );
}
