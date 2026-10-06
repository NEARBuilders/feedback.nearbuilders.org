export interface WorkspaceRound {
  roundId: string;
  roundTitle: string;
  projectSlug: string;
  status: string;
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

function rank(round: WorkspaceRound): number {
  if (awaitingFeedback(round)) return 0;
  if (round.status === "open") return 1;
  return 2;
}

export function sortWorkspaceRounds<T extends WorkspaceRound>(rounds: T[]): T[] {
  return [...rounds].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
  });
}

export interface WorkspaceSummary {
  total: number;
  open: number;
  awaitingFeedback: number;
}

export function summarizeWorkspace(rounds: WorkspaceRound[]): WorkspaceSummary {
  return {
    total: rounds.length,
    open: rounds.filter((round) => round.status === "open").length,
    awaitingFeedback: rounds.filter(awaitingFeedback).length,
  };
}

export function feedbackPostedLabel(count: number): string {
  if (count === 0) return "No feedback posted yet";
  return `${count} ${count === 1 ? "feedback item" : "feedback items"} posted`;
}
