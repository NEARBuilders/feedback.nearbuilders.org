import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components";

/** The admin-toggled diligence mark shown on project and round surfaces. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="success" className={className} data-testid="verified-badge">
      <BadgeCheck />
      verified
    </Badge>
  );
}
