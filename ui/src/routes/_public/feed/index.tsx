import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/feed/")({
  beforeLoad: () => {
    throw redirect({ to: "/rounds", replace: true });
  },
});
