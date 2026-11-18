export interface AgentIntakeInput {
  roundTitle: string;
  projectSlug: string;
  /** Absolute link to the round, so the assistant knows what is being tested. */
  roundUrl: string;
}

/**
 * A prompt a tester pastes into their own AI assistant (#300). The assistant interviews them
 * and drafts the report; the tester pastes the draft back into the feedback box. We never see
 * the conversation, no model runs on our side, and the tester stays the author: they read,
 * edit and post the text themselves.
 */
export function buildAgentIntakePrompt({
  roundTitle,
  projectSlug,
  roundUrl,
}: AgentIntakeInput): string {
  return [
    `I'm testing "${projectSlug}" and want to send feedback on this test round: "${roundTitle}" (${roundUrl}).`,
    "",
    "Help me write clear feedback. Interview me before you write anything:",
    "- Ask one question at a time, and no more than three follow-up questions.",
    "- Ask what I was trying to do, what actually happened, and what I expected instead.",
    "- If something is unclear, ask me to describe it. Don't guess.",
    "",
    "Then write the feedback in markdown, using only these headings and only the ones I gave",
    "you answers for:",
    "",
    "**What I was trying to do**",
    "**What happened**",
    "**What I expected**",
    "",
    "Rules:",
    "- Use my own words as much as possible.",
    "- Do not invent steps, errors or details I didn't tell you.",
    "- Do not include anything private, like keys, seed phrases or personal data.",
    "- Reply with only the finished markdown so I can paste it straight into the feedback box.",
  ].join("\n");
}
