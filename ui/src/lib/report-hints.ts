import { feedbackTextLength } from "@/lib/feedback-body";

/**
 * Gentle follow-up prompts for a thin report (#300). They stand in for an agent asking
 * questions: no model, no cost, nothing sent anywhere, and the tester stays the author of
 * every word. Hints never block posting; they only point at what an owner usually has to ask.
 */
export interface ReportHint {
  id: "short" | "steps" | "expected";
  text: string;
}

const MIN_USEFUL_LENGTH = 80;
const STEPS =
  /\b(step|steps|then|after|when i|i clicked|i tapped|i opened|went to|tried to|repro)\b|^\s*\d+[.)]/im;
const EXPECTED = /\b(expect|expected|should|supposed to|instead|but it|however)\b/i;

export function reportHints(body: string): ReportHint[] {
  const length = feedbackTextLength(body);
  // Stay quiet until the tester has started writing.
  if (length === 0) return [];
  if (length < MIN_USEFUL_LENGTH) {
    return [
      {
        id: "short",
        text: "A little more helps. What were you trying to do, and what happened?",
      },
    ];
  }
  const hints: ReportHint[] = [];
  if (!STEPS.test(body)) {
    hints.push({ id: "steps", text: "What did you do just before it happened?" });
  }
  if (!EXPECTED.test(body)) {
    hints.push({ id: "expected", text: "What did you expect to happen instead?" });
  }
  return hints;
}
