import { Link } from "@tanstack/react-router";
import { Button } from "@/components";

const COLUMNS = [
  {
    heading: "For projects",
    points: [
      "Describe what to test and choose written, recorded or GitHub-issue feedback.",
      "Keep rounds private, restrict to Legion holders, or set a deadline.",
      "Triage feedback in one inbox and mark winners when the round closes.",
    ],
    cta: { label: "request a round", to: "/manage/new" },
  },
  {
    heading: "For testers",
    points: [
      "Join an open round and try the product during the window.",
      "Submit notes or a recorded session, and edit them until the round closes.",
      "Your participation and wins show on your NEAR Builders profile.",
    ],
    cta: { label: "browse open rounds", to: "/rounds" },
  },
] as const;

export function LandingAudience() {
  return (
    <section className="grid gap-px border border-border bg-border md:grid-cols-2">
      {COLUMNS.map(({ heading, points, cta }) => (
        <div key={heading} className="space-y-4 bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{heading}</h2>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            {points.map((point) => (
              <li key={point} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 bg-foreground" />
                {point}
              </li>
            ))}
          </ul>
          <Button asChild>
            <Link to={cta.to}>{cta.label}</Link>
          </Button>
        </div>
      ))}
    </section>
  );
}
