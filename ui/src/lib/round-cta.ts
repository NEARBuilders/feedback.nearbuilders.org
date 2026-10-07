export type RoundCtaInput = {
  redirectTo: string;
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

export function roundCta(input: RoundCtaInput): RoundCta {
  if (!input.canJoin) return { kind: "none" };
  if (input.sessionPending) {
    if (!input.nearAccountId) return { kind: "none" };
    return input.joined ? { kind: "leave" } : { kind: "join" };
  }
  if (!input.signedIn) {
    return { kind: "signin", loginTo: { to: "/login", search: { redirect: input.redirectTo } } };
  }
  if (!input.nearAccountId) return { kind: "link-account" };
  return input.joined ? { kind: "leave" } : { kind: "join" };
}
