export type RoundCtaInput = {
  roundId: string;
  canJoin: boolean;
  sessionPending: boolean;
  signedIn: boolean;
  nearAccountId: string | null;
  joined: boolean;
};

export type RoundCta =
  | { kind: "join" }
  | { kind: "leave" }
  | { kind: "signin"; loginTo: { to: "/login"; search: { redirect: string } } }
  | { kind: "link-account" }
  | { kind: "none" };

export function signInToJoinLink(roundId: string) {
  return {
    to: "/login" as const,
    search: { redirect: `/feed/${roundId}` },
  };
}

export function roundCta(input: RoundCtaInput): RoundCta {
  if (!input.canJoin) return { kind: "none" };
  if (input.nearAccountId) {
    return input.joined ? { kind: "leave" } : { kind: "join" };
  }
  if (input.sessionPending) return { kind: "none" };
  if (!input.signedIn) {
    return { kind: "signin", loginTo: signInToJoinLink(input.roundId) };
  }
  return { kind: "link-account" };
}
