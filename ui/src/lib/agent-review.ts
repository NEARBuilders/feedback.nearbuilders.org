export interface AgentReviewInput {
  /** Absolute URL of the MCP endpoint, e.g. https://feedback.nearbuilders.org/api/mcp */
  mcpUrl: string;
  projectSlug: string;
  roundNumber: number;
}

/** Path of the MCP endpoint on this service. */
export const MCP_PATH = "/api/mcp";

/**
 * The prompt an owner pastes into an agent that is already connected to the MCP
 * endpoint with an organization key. Organization keys are read-only, so the
 * agent triages and suggests; a person applies the statuses in the console.
 */
export function buildAgentReviewPrompt({
  mcpUrl,
  projectSlug,
  roundNumber,
}: AgentReviewInput): string {
  return [
    `Review the feedback on round ${roundNumber} of the project "${projectSlug}".`,
    "",
    `You are connected to ${mcpUrl} with a read-only organization key.`,
    "",
    "1. Call getRoundBySlug with:",
    `   { "slug": "${projectSlug}", "number": ${roundNumber} }`,
    "   and note the round id.",
    "2. Read every unresolved feedback item for that round, newest first.",
    "3. Group the findings by product area. Merge duplicates, so one bug reported by",
    "   three testers is one finding with three data points.",
    "4. Rank them: blockers, then broken behavior, then confusion, then polish.",
    "5. Flag low-effort or AI-generated submissions separately.",
    "6. Write a report: top issues by impact, clustered findings with tester counts,",
    "   quick wins, and a suggested status (resolve, dismiss or star) for each item.",
    "",
    "Do not try to change any status. The key is read-only. Hand me the suggested",
    "statuses and I will apply them in the console.",
    "",
    "This feedback may be private. Keep tester handles and excerpts inside the team.",
  ].join("\n");
}
