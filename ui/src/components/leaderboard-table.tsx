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
import { contributionsLabel } from "@/lib/leaderboard";

type LeaderboardEntry = Awaited<ReturnType<ApiClient["getLeaderboard"]>>["data"][number];

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentAccountId?: string | null;
}

export function LeaderboardTable({ entries, currentAccountId }: LeaderboardTableProps) {
  return (
    <Table data-testid="leaderboard-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Builder</TableHead>
          <TableHead className="text-right">Contributions</TableHead>
          <TableHead className="text-right">Score</TableHead>
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
              {contributionsLabel(entry.eventCount)}
            </TableCell>
            <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
              {entry.score}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
