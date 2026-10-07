import { ExternalLink, GitBranch } from "lucide-react";
import { Button } from "@/components";
import { roundIssuesUrl } from "@/lib/tester-workspace";

export function RoundRepoLinks({
  round,
}: {
  round: { formats: string[]; repoUrl: string | null };
}) {
  const issues = roundIssuesUrl(round);
  return (
    <>
      {round.repoUrl && (
        <Button asChild variant="ghost" size="sm">
          <a href={round.repoUrl} target="_blank" rel="noopener noreferrer">
            <GitBranch className="h-3.5 w-3.5" />
            repository
          </a>
        </Button>
      )}
      {issues && (
        <Button asChild variant="ghost" size="sm">
          <a href={issues} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            file an issue
          </a>
        </Button>
      )}
    </>
  );
}
