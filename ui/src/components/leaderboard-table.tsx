import { Link } from "@tanstack/react-router";
import type { ApiClient } from "@/app";
import { Badge } from "@/components";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type LeaderboardMetric, submissionsLabel } from "@/lib/leaderboard";
import { acceptedLabel } from "@/lib/points";

type LeaderboardEntry = Awaited<ReturnType<ApiClient["getLeaderboard"]>>["data"][number];

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentAccountId?: string | null;
  metric?: LeaderboardMetric;
}

export function LeaderboardTable({
  entries,
  currentAccountId,
  metric = "submissions",
}: LeaderboardTableProps) {
  const isPoints = metric === "points";
  return (
    <Table data-testid="leaderboard-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Builder</TableHead>
          <TableHead className="text-right">{isPoints ? "Accepted" : "Submissions"}</TableHead>
          <TableHead className={`text-right ${isPoints ? "" : "hidden sm:table-cell"}`}>
            {isPoints ? "Points" : "Score"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.actor}>
            <TableCell>
              <Badge variant={entry.rank <= 3 ? "secondary" : "outline"} className="text-[10px]">
                #{entry.rank}
              </Badge>
            </TableCell>
            <TableCell className="min-w-0">
              <Link
                to="/$accountId"
                params={{ accountId: entry.actor }}
                className="font-mono text-sm font-medium text-foreground hover:underline break-all"
              >
                {entry.actor}
              </Link>
              {entry.actor === currentAccountId && <Badge className="ml-2 text-[10px]">you</Badge>}
            </TableCell>
            <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
              {isPoints ? acceptedLabel(entry.eventCount) : submissionsLabel(entry.eventCount)}
            </TableCell>
            <TableCell
              className={`text-right text-sm tabular-nums ${
                isPoints
                  ? "font-semibold text-foreground"
                  : "hidden sm:table-cell text-muted-foreground"
              }`}
            >
              {entry.score}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
