import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useApiClient } from "@/app";
import { LandingAudience } from "@/components/landing/landing-audience";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingLiveRounds } from "@/components/landing/landing-live-rounds";
import { LandingProof } from "@/components/landing/landing-proof";
import { LandingWhy } from "@/components/landing/landing-why";
import { PageContainer } from "@/components/layout/page-container";
import { computeLandingStats, liveRounds } from "@/lib/landing-stats";
import { pageHead } from "@/lib/page-title";
import { roundsQueryOptions } from "@/lib/queries/rounds";

export const Route = createFileRoute("/_public/")({
  head: () =>
    pageHead(
      undefined,
      "Project owners request testing rounds, builders sign up to test and share feedback, and contributors get credit on their NEAR Builders profile.",
    ),
  component: LandingPage,
});

const LIVE_ROUNDS_LIMIT = 5;

function LandingPage() {
  const apiClient = useApiClient();
  const open = useQuery(roundsQueryOptions(apiClient, "open"));
  const closed = useQuery(roundsQueryOptions(apiClient, "closed"));
  const stats = open.data && closed.data ? computeLandingStats(open.data, closed.data) : null;

  return (
    <PageContainer variant="wide" className="pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="space-y-16 sm:space-y-20">
        <LandingHero />
        <LandingProof stats={stats} />
        <LandingLiveRounds
          rounds={open.data ? liveRounds(open.data, LIVE_ROUNDS_LIMIT) : []}
          isLoading={open.isPending}
          isError={open.isError}
        />
        <LandingWhy />
        <LandingAudience />
        <LandingCta />
      </div>
    </PageContainer>
  );
}
