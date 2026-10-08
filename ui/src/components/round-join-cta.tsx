import { Link } from "@tanstack/react-router";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoundCta } from "@/lib/round-cta";
import { useRoundJoinMutation } from "@/lib/round-join";
import { roundParams } from "@/lib/round-links";

interface RoundJoinCtaProps {
  round: { id: string; projectSlug: string; projectRoundNumber: number };
  cta: RoundCta;
  size?: "default" | "sm";
  /** Disables the join/leave button while a Legion gate check resolves or fails. */
  legionBlocked?: boolean;
  /** Extra primary action shown next to the join button, e.g. "write feedback". */
  canPost?: boolean;
}

/**
 * The join/leave/sign-in CTA shared by the round page and the rounds table.
 * Renders nothing when the viewer has no action to take.
 */
export function RoundJoinCta({
  round,
  cta,
  size = "default",
  legionBlocked,
  canPost,
}: RoundJoinCtaProps) {
  const joinMutation = useRoundJoinMutation();

  if (cta.kind === "none") return null;

  return (
    <div className="flex gap-2">
      {canPost && (
        <Button asChild variant="outline" size={size}>
          <Link to="/projects/$slug/$n/submit" params={roundParams(round)}>
            <PenLine className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
            write feedback
          </Link>
        </Button>
      )}
      {(cta.kind === "join" || cta.kind === "leave") && (
        <Button
          variant={cta.kind === "leave" ? "outline" : "default"}
          size={size}
          onClick={() => joinMutation.mutate({ roundId: round.id, join: cta.kind === "join" })}
          disabled={joinMutation.isPending || legionBlocked}
        >
          {cta.kind === "leave" ? "leave round" : "join round"}
        </Button>
      )}
      {cta.kind === "signin" && (
        <Button asChild variant="outline" size={size}>
          <Link to={cta.loginTo.to} search={cta.loginTo.search}>
            sign in to join
          </Link>
        </Button>
      )}
      {cta.kind === "link-account" && (
        <Button asChild variant="outline" size={size}>
          <Link to="/settings/auth-methods">link a NEAR account</Link>
        </Button>
      )}
    </div>
  );
}
