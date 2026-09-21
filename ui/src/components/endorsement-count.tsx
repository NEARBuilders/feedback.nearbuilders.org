import { Heart } from "lucide-react";
import { endorsementLabel } from "@/lib/activity-events";

/** Social-proof chip for a round's activity event; renders nothing at zero. */
export function EndorsementCount({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Heart className="h-3 w-3" />
      {endorsementLabel(count)}
    </span>
  );
}
