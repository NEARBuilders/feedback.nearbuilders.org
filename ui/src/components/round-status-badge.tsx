import { CircleDot, Clock, Lock, XCircle } from "lucide-react";
import { Badge } from "@/components";
import type { RoundStatus } from "@/lib/queries/rounds";

const ROUND_STATUS: Record<
  RoundStatus,
  { variant: "default" | "success" | "outline" | "destructive"; icon: typeof Clock }
> = {
  pending: { variant: "default", icon: Clock },
  open: { variant: "success", icon: CircleDot },
  closed: { variant: "outline", icon: Lock },
  rejected: { variant: "destructive", icon: XCircle },
};

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  const { variant, icon: Icon } = ROUND_STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon />
      {status}
    </Badge>
  );
}
