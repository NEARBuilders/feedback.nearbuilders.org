import { createFileRoute } from "@tanstack/react-router";
import { MousePointerClick } from "lucide-react";
import { EmptyState } from "@/components";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/_inbox/")({
  component: () => (
    <EmptyState
      icon={MousePointerClick}
      title="Pick a feedback item."
      description="Press j to open the first one."
      className="hidden min-h-[30vh] rounded-lg border border-dashed border-border lg:flex"
    />
  ),
});
