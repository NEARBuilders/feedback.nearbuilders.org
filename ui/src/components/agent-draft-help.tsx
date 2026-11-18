import { Bot } from "lucide-react";
import { Button } from "@/components";
import { buildAgentIntakePrompt } from "@/lib/agent-intake-prompt";
import { roundHref } from "@/lib/round-links";
import { absoluteUrl, copyText } from "@/lib/share";

interface AgentDraftHelpProps {
  round: { title: string; projectSlug: string; projectRoundNumber: number };
}

/**
 * "Draft with your own agent" (#300): copies a prompt for the tester's own assistant to
 * interview them and write the report. Nothing is sent to us until they paste the result
 * into the box and post it.
 */
export function AgentDraftHelp({ round }: AgentDraftHelpProps) {
  const copyPrompt = () =>
    void copyText(
      buildAgentIntakePrompt({
        roundTitle: round.title,
        projectSlug: round.projectSlug,
        roundUrl: absoluteUrl(roundHref(round)),
      }),
      "Prompt copied. Paste it into your assistant.",
    );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-muted p-3">
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        Prefer to talk it through? Copy a prompt, paste it into your own AI assistant, answer its
        questions, then paste the draft here. We never see that conversation, and you review and
        post the text yourself.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={copyPrompt}>
        <Bot className="h-3.5 w-3.5" />
        copy prompt
      </Button>
    </div>
  );
}
