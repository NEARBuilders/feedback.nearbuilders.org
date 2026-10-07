import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components";
import type { FeedbackStatus } from "@/lib/queries/feedback";

const ACTIONS = [
  { status: "resolved", label: "resolve", icon: Check, variant: "default", hotkey: "r" },
  { status: "dismissed", label: "dismiss", icon: X, variant: "outline", hotkey: "d" },
  { status: "unresolved", label: "reopen", icon: RotateCcw, variant: "ghost", hotkey: null },
] as const;

interface FeedbackStatusActionsProps {
  current: FeedbackStatus;
  onChange: (status: FeedbackStatus) => void;
  disabled?: boolean;
}

export function FeedbackStatusActions({ current, onChange, disabled }: FeedbackStatusActionsProps) {
  return ACTIONS.filter((action) => action.status !== current).map(
    ({ status, label, icon: Icon, variant, hotkey }) => (
      <Button
        key={status}
        size="sm"
        variant={variant}
        onClick={() => onChange(status)}
        disabled={disabled}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        {hotkey && <kbd className="text-[10px] opacity-60">{hotkey}</kbd>}
      </Button>
    ),
  );
}
