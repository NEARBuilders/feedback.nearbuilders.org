import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Home as HomeIcon, Settings } from "lucide-react";
import { useMemo } from "react";
import {
  getAccount,
  type SessionData,
  sessionQueryOptions,
  useApiClient,
  useAuthClient,
} from "@/app";
import {
  Badge,
  Button,
  Card,
  InfoRow,
  MyProjects,
  PageHeader,
  SectionHeader,
  Skeleton,
} from "@/components";
import { pageHead } from "@/lib/page-title";
import { useNearAccountStatus } from "@/lib/use-near-account";

const ROUND_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "default",
  open: "secondary",
  closed: "outline",
  rejected: "destructive",
};

export const Route = createFileRoute("/_authenticated/_dashboard/dashboard/")({
  beforeLoad: async ({ context }) => {
    const { apiClient, runtimeConfig } = context;
    const accountId = getAccount(runtimeConfig);
    let tenant: Awaited<ReturnType<typeof apiClient.resolveTenant>> | null = null;
    try {
      tenant = await apiClient.resolveTenant({ accountId });
    } catch {
      tenant = null;
    }
    return { tenant };
  },
  head: () => pageHead("Dashboard", "Your workspace."),
  component: Home,
});

function Home() {
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const { tenant } = Route.useRouteContext();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth, undefined));
  const user = session?.user;

  const { accountId: nearAccountId, isDetecting } = useNearAccountStatus();

  const joinedRoundsQuery = useQuery({
    queryKey: ["myRounds", "joined"],
    queryFn: () => apiClient.listMyJoinedRounds(),
    enabled: !!nearAccountId,
  });

  const joinedRounds = useMemo(() => {
    const rounds = joinedRoundsQuery.data ?? [];
    return [...rounds].sort((a, b) => {
      if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
      return 0;
    });
  }, [joinedRoundsQuery.data]);

  const openCount = joinedRounds.filter((round) => round.status === "open").length;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={HomeIcon}
        label="Workspace"
        title={user?.name || user?.email || "You"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/feed/request" preload="intent">
                request a round
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings" preload="intent">
                <Settings />
                settings
              </Link>
            </Button>
          </div>
        }
      />

      {!user ? (
        <div className="text-muted-foreground text-center py-12 text-sm">Loading…</div>
      ) : (
        <>
          <JoinedRounds
            query={joinedRoundsQuery}
            rounds={joinedRounds}
            openCount={openCount}
            hasNear={!!nearAccountId}
            settled={!isDetecting}
          />

          <MyProjects />
        </>
      )}

      {tenant && (
        <Card className="p-6 space-y-4">
          <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
            Tenant
          </div>
          <div className="flex flex-col gap-2">
            <InfoRow label="name" value={tenant.name} />
            <InfoRow label="id" value={tenant.id} mono />
            <InfoRow label="account" value={tenant.accountId} mono />
            <InfoRow
              label="created"
              value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "—"}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin" preload="intent">
                manage tenant
              </Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function JoinedRounds({
  query,
  rounds,
  openCount,
  hasNear,
  settled,
}: {
  query: { isLoading: boolean };
  rounds: Array<{
    roundId: string;
    roundTitle: string;
    projectSlug: string;
    status: string;
    participantCount: number;
  }>;
  openCount: number;
  hasNear: boolean;
  settled: boolean;
}) {
  if (!hasNear) {
    if (!settled) {
      return (
        <div className="space-y-3">
          <SectionHeader title="Rounds you're testing" />
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-16 w-full" />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <SectionHeader title="Rounds you're testing" />
        <Card className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Link a NEAR account to see the rounds you've joined as a tester.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/auth-methods">link a NEAR account</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Rounds you're testing"
        action={
          rounds.length > 0 ? (
            <span className="flex items-center gap-3 text-sm text-muted-foreground">
              {openCount} open · {rounds.length} total
              <Link to="/testing" className="text-foreground underline">
                open tester workspace
              </Link>
            </span>
          ) : undefined
        }
      />
      {query.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16 w-full" />
          ))}
        </div>
      ) : rounds.length === 0 ? (
        <Card className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">You haven't joined any rounds yet.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/feed">browse open rounds</Link>
          </Button>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rounds.map((round) => (
            <li key={round.roundId}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link
                      to="/feed/$roundId"
                      params={{ roundId: round.roundId }}
                      className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {round.roundTitle}
                    </Link>
                    <p className="text-xs font-mono text-muted-foreground">{round.projectSlug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ROUND_BADGE_VARIANT[round.status] ?? "outline"}>
                      {round.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {round.participantCount}{" "}
                      {round.participantCount === 1 ? "builder" : "builders"}
                    </span>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
