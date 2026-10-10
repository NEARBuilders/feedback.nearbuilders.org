export interface RoundRef {
  projectSlug: string;
  projectRoundNumber: number;
}

export interface RoundParams {
  slug: string;
  n: string;
}

export function roundParams(round: RoundRef): RoundParams {
  return { slug: round.projectSlug, n: String(round.projectRoundNumber) };
}

export function roundHref(round: RoundRef): string {
  return `/projects/${encodeURIComponent(round.projectSlug)}/${round.projectRoundNumber}`;
}

export function myFeedbackHref(round: RoundRef, accountId: string): string {
  return `${roundHref(round)}/feedback?author=${encodeURIComponent(accountId)}`;
}

export type ParticipantPostsSurface = "public" | "console";

export type ParticipantPostLink =
  | {
      to: "/projects/$slug/$n/feedback";
      params: RoundParams;
      search: { author: string };
    }
  | {
      to: "/manage/$slug/$n";
      params: RoundParams;
      search: { status: "all"; author: string };
    };

export function participantPostLink(
  accountId: string,
  feedbackCount: number,
  dest?: { surface: ParticipantPostsSurface; params: RoundParams },
): ParticipantPostLink | null {
  if (feedbackCount <= 0 || !dest) return null;
  if (dest.surface === "console") {
    return {
      to: "/manage/$slug/$n",
      params: dest.params,
      search: { status: "all", author: accountId },
    };
  }
  return {
    to: "/projects/$slug/$n/feedback",
    params: dest.params,
    search: { author: accountId },
  };
}
