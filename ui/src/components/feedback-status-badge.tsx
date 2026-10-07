import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "@/components";
import type { FeedbackStatus } from "@/lib/queries/feedback";

const FEEDBACK_STATUS: Record<
  FeedbackStatus,
  { variant: "secondary" | "success" | "outline"; icon: typeof CheckCircle2 }
> = {
  unresolved: { variant: "secondary", icon: CircleDashed },
  resolved: { variant: "success", icon: CheckCircle2 },
  dismissed: { variant: "outline", icon: XCircle },
};

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const { variant, icon: Icon } = FEEDBACK_STATUS[status];
  return (
    <Badge variant={variant} className="text-[10px]">
      <Icon />
      {status}
    </Badge>
  );
}
