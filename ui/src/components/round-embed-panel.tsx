import { Copy } from "lucide-react";
import { Button, Card } from "@/components";
import { useClientValue } from "@/hooks";
import { absoluteUrl, copyText } from "@/lib/share";

const EMBED_PATH = "/embed.js";

export function embedSnippet(scriptUrl: string, projectSlug: string): string {
  return `<script src="${scriptUrl}" data-project="${projectSlug}" defer></script>`;
}

/** The one-line snippet that adds a feedback button to a project's own app (#294). */
export function RoundEmbedPanel({ projectSlug }: { projectSlug: string }) {
  const scriptUrl = useClientValue(() => absoluteUrl(EMBED_PATH), EMBED_PATH);
  const snippet = embedSnippet(scriptUrl, projectSlug);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Add a feedback button</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyText(snippet, "Snippet copied")}
        >
          <Copy className="h-3.5 w-3.5" />
          copy
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-border bg-muted p-3 font-mono text-xs text-foreground">
        {snippet}
      </pre>
      <p className="text-xs text-muted-foreground">
        Paste this into your app. The button opens your latest open round's send-feedback page in a
        popup. Testers still sign in and join here. Optional:{" "}
        <code className="font-mono">data-label</code> and{" "}
        <code className="font-mono">data-position="left"</code>.
      </p>
    </Card>
  );
}
