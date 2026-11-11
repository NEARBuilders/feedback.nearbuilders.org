import type { LandingStats } from "@/lib/landing-stats";

const ITEMS: Array<{ key: keyof LandingStats; label: string }> = [
  { key: "openRounds", label: "open rounds" },
  { key: "testers", label: "testers joined" },
  { key: "completedRounds", label: "rounds completed" },
  { key: "winnersRecognised", label: "winners recognised" },
];

export function LandingProof({ stats }: { stats: LandingStats | null }) {
  return (
    <section
      aria-label="Platform activity"
      className="grid grid-cols-2 divide-border border border-border bg-card sm:grid-cols-4 sm:divide-x"
    >
      {ITEMS.map(({ key, label }) => (
        <div key={key} className="space-y-1 border-border p-4 max-sm:border-b">
          <p className="text-2xl font-semibold leading-none tracking-tight text-foreground">
            {stats ? stats[key] : "-"}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </section>
  );
}
