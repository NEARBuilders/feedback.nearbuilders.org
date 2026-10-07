import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/app";
import { Badge, Card } from "@/components";
import { SectionHeader } from "@/components/layout/section-header";
import { roundCreditsQueryOptions } from "@/lib/queries/rounds";

export function RoundCredits({ roundId }: { roundId: string }) {
  const apiClient = useApiClient();
  const { data: credits = [], isLoading } = useQuery(roundCreditsQueryOptions(apiClient, roundId));

  if (isLoading || credits.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader title="Credited contributors" />
      <ul className="space-y-2">
        {credits.map((credit) => (
          <li key={credit.id}>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">{credit.builderAccountId}</span>
                {credit.contributedMeaningfully && (
                  <Badge variant="secondary" className="text-[10px]">
                    meaningful
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {credit.writtenCount} written · {credit.recordedCount} recorded
              </p>
              {credit.summary && <p className="text-sm text-foreground">{credit.summary}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
