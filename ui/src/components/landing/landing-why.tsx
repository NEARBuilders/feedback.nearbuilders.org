import { ClipboardCheck, Lock, MessageSquare, Trophy, UserCheck } from "lucide-react";

const TILES = [
  {
    icon: MessageSquare,
    title: "A project requests a round",
    body: "Describe what to test, pick the feedback formats you want, and open the round for signups.",
  },
  {
    icon: UserCheck,
    title: "Builders sign up and test",
    body: "Builders join, try the product, and submit written notes, a recorded session or GitHub issues.",
  },
  {
    icon: Lock,
    title: "Private when you need it",
    body: "Rounds are private by default: feedback is readable only by your team and each author.",
  },
  {
    icon: Trophy,
    title: "Winners get recognised",
    body: "Mark the best contributors as winners, ranked, right on the participants list.",
  },
  {
    icon: ClipboardCheck,
    title: "Credit that lasts",
    body: "Every round closes with a durable record that shows on each builder's NEAR Builders profile.",
  },
];

export function LandingWhy() {
  return (
    <section className="space-y-6" aria-labelledby="why-feedback">
      <h2
        id="why-feedback"
        className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        How a round works
      </h2>
      <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="space-y-3 bg-card p-5">
            <div className="flex size-10 items-center justify-center bg-foreground text-background">
              <Icon className="size-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
