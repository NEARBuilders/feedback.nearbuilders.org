import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "@/components";
import { FailedActivityPanel } from "@/components/failed-activity-panel";
import { pageHead } from "@/lib/page-title";

export const Route = createFileRoute("/_admin/_dashboard/admin/activity")({
  head: () => pageHead("Activity events"),
  component: AdminActivityPage,
});

function AdminActivityPage() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Activity events" />
      <p className="text-sm text-muted-foreground">
        Reputation events that never reached the activity gateway after several tries. Retry them
        once the gateway is back.
      </p>
      <FailedActivityPanel />
    </section>
  );
}
