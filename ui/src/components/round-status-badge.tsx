import { CircleDot, Clock, Lock, TimerOff, XCircle } from "lucide-react";
import { Badge } from "@/components";
import type { RoundStatus } from "@/lib/queries/rounds";
import { isRoundExpired } from "@/lib/round-expiry";

const ROUND_STATUS: Record<
  RoundStatus,
  { variant: "default" | "success" | "outline" | "destructive"; icon: typeof Clock }
> = {
  pending: { variant: "default", icon: Clock },
  open: { variant: "success", icon: CircleDot },
  closed: { variant: "outline", icon: Lock },
  rejected: { variant: "destructive", icon: XCircle },
};

export function RoundStatusBadge({
  status,
  endsAt,
}: {
  status: RoundStatus;
  endsAt?: string | null;
}) {
  if (isRoundExpired({ status, endsAt })) {
    return (
      <Badge variant="outline">
        <TimerOff />
        expired
      </Badge>
    );
  }
  const { variant, icon: Icon } = ROUND_STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon />
      {status}
    </Badge>
  );
}
