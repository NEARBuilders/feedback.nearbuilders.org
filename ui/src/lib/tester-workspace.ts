import type { RoundStatus } from "@/lib/queries/rounds";

export interface WorkspaceRound {
  roundId: string;
  roundTitle: string;
  projectSlug: string;
  projectRoundNumber: number;
  status: RoundStatus;
  formats: string[];
  readme: string;
  repoUrl: string | null;
  participantCount: number;
  myFeedbackCount: number;
  joinedAt: string;
}

export type NextActionKind = "give-feedback" | "add-feedback" | "file-issues" | "view-round";

export interface NextAction {
  kind: NextActionKind;
  label: string;
}

function collectsPostedFeedback(round: WorkspaceRound): boolean {
  return round.formats.includes("written") || round.formats.includes("recorded");
}

export function issuesUrl(repoUrl: string | null): string | null {
  return repoUrl ? `${repoUrl.replace(/\/+$/, "")}/issues` : null;
}

export function roundIssuesUrl(round: { formats: string[]; repoUrl: string | null }) {
  return round.formats.includes("issues") ? issuesUrl(round.repoUrl) : null;
}

export function nextAction(round: WorkspaceRound): NextAction {
  if (round.status !== "open") return { kind: "view-round", label: "View round" };
  if (collectsPostedFeedback(round)) {
    return round.myFeedbackCount === 0
      ? { kind: "give-feedback", label: "Give feedback" }
      : { kind: "add-feedback", label: "Add more feedback" };
  }
  if (issuesUrl(round.repoUrl)) return { kind: "file-issues", label: "File an issue" };
  return { kind: "view-round", label: "View round" };
}

export function awaitingFeedback(round: WorkspaceRound): boolean {
  return round.status === "open" && collectsPostedFeedback(round) && round.myFeedbackCount === 0;
}

export interface WorkspaceGroups<T extends WorkspaceRound> {
  needsFeedback: T[];
  submitted: T[];
  closed: T[];
}

function newestJoinedFirst(a: WorkspaceRound, b: WorkspaceRound): number {
  return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
}

export function groupWorkspaceRounds<T extends WorkspaceRound>(rounds: T[]): WorkspaceGroups<T> {
  const groups: WorkspaceGroups<T> = { needsFeedback: [], submitted: [], closed: [] };
  for (const round of [...rounds].sort(newestJoinedFirst)) {
    if (round.status !== "open") groups.closed.push(round);
    else if (awaitingFeedback(round)) groups.needsFeedback.push(round);
    else groups.submitted.push(round);
  }
  return groups;
}

export function feedbackPostedLabel(count: number): string {
  if (count === 0) return "No feedback posted yet";
  return `${count} ${count === 1 ? "feedback item" : "feedback items"} posted`;
}
