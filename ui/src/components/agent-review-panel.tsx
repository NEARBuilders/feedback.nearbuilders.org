import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink } from "lucide-react";
import { Button, Card } from "@/components";
import { useIdentity } from "@/components/layout/use-identity";
import { useClientValue } from "@/hooks";
import { buildAgentReviewPrompt, MCP_PATH } from "@/lib/agent-review";
import { absoluteUrl, copyText } from "@/lib/share";

interface AgentReviewPanelProps {
  round: {
    projectSlug: string;
    projectRoundNumber: number;
  };
}

function CopyRow({ label, value, message }: { label: string; value: string; message: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Button variant="outline" size="sm" onClick={() => void copyText(value, message)}>
          <Copy className="h-3.5 w-3.5" />
          copy
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-border bg-muted p-3 font-mono text-xs text-foreground">
        {value}
      </pre>
    </div>
  );
}

/**
 * Everything an owner needs to point an agent at this round: the MCP endpoint,
 * where to mint a read-only organization key, and a ready-made review prompt.
 * The key itself is never shown or stored here (#297).
 */
export function AgentReviewPanel({ round }: AgentReviewPanelProps) {
  const { activeOrg: keyOrg } = useIdentity();
  const mcpUrl = useClientValue(() => absoluteUrl(MCP_PATH), MCP_PATH);

  const prompt = buildAgentReviewPrompt({
    mcpUrl,
    projectSlug: round.projectSlug,
    roundNumber: round.projectRoundNumber,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card className="space-y-5 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-foreground">Review this round with an agent</h2>
          <p className="text-sm text-muted-foreground">
            Connect an agent to this round, then paste the prompt. The agent reads the feedback and
            suggests what to resolve or dismiss. You apply the statuses here in the console.
          </p>
        </div>
        <CopyRow label="MCP endpoint" value={mcpUrl} message="Endpoint copied" />
        <CopyRow label="Auth header" value="x-api-key: <your organization key>" message="Copied" />
        <CopyRow label="Prompt" value={prompt} message="Prompt copied" />
      </Card>

      <div className="space-y-6">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-medium text-foreground">1. Get a key</h2>
          <p className="text-sm text-muted-foreground">
            An organization owner or admin creates an organization key on the organization page,
            under the API Keys tab. The key starts with <code className="font-mono">org_</code> and
            is shown once, so store it somewhere safe.
          </p>
          <Button asChild variant="outline" size="sm">
            {keyOrg ? (
              <Link to="/orgs/$slug" params={{ slug: keyOrg.slug }}>
                <ExternalLink className="h-3.5 w-3.5" />
                open {keyOrg.name}
              </Link>
            ) : (
              <Link to="/orgs">
                <ExternalLink className="h-3.5 w-3.5" />
                open organizations
              </Link>
            )}
          </Button>
        </Card>

        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-medium text-foreground">2. Know the limits</h2>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Organization keys are read-only. An agent can read, not resolve or dismiss.</li>
            <li>The key can read private feedback for this organization's projects.</li>
            <li>Anyone holding the key can read that feedback, so treat it like a password.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
