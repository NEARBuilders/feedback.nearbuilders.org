import { createFileRoute, redirect } from "@tanstack/react-router";
import { RouteNotFound } from "@/components/route-states";
import { orNotFound } from "@/lib/queries/not-found";
import { roundQueryOptions } from "@/lib/queries/rounds";
import { roundParams } from "@/lib/round-links";

export const Route = createFileRoute("/_public/feed/$roundId")({
  beforeLoad: async ({ context, params }) => {
    const round = await orNotFound(
      context.queryClient.ensureQueryData(roundQueryOptions(context.apiClient, params.roundId)),
    );
    throw redirect({ to: "/projects/$slug/$n", params: roundParams(round), replace: true });
  },
  notFoundComponent: () => <RouteNotFound title="Round not found." backTo="/rounds" />,
});
