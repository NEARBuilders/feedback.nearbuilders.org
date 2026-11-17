/**
 * A guided issue report (#300): a few short questions instead of one blank box, composed
 * into a structured markdown body. No model is involved. The tester writes every word.
 */
export const GUIDED_QUESTIONS = [
  {
    key: "goal",
    label: "What were you trying to do?",
    placeholder: "For example: send tokens to a friend",
    rows: 2,
  },
  {
    key: "actual",
    label: "What happened?",
    placeholder: "What went wrong?",
    rows: 3,
  },
  {
    key: "expected",
    label: "What did you expect instead?",
    placeholder: "Optional",
    rows: 2,
  },
] as const;

export type GuidedKey = (typeof GUIDED_QUESTIONS)[number]["key"];
export type GuidedAnswers = Record<GuidedKey, string>;

export const EMPTY_GUIDED_ANSWERS: GuidedAnswers = { goal: "", actual: "", expected: "" };

const HEADINGS: Record<GuidedKey, string> = {
  goal: "What I was trying to do",
  actual: "What happened",
  expected: "What I expected",
};

/** Only "what happened" is required: it is the one thing an owner can't do without. */
export function isGuidedComplete(answers: GuidedAnswers): boolean {
  return answers.actual.trim().length > 0;
}

/** Each answered question becomes a bold heading and its answer; empty ones are skipped. */
export function composeGuidedReport(answers: GuidedAnswers): string {
  return GUIDED_QUESTIONS.filter(({ key }) => answers[key].trim().length > 0)
    .map(({ key }) => `**${HEADINGS[key]}**\n\n${answers[key].trim()}`)
    .join("\n\n");
}
