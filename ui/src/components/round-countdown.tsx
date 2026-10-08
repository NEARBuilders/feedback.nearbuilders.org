import { useEffect, useState } from "react";

function parts(remainingMs: number) {
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const segments = [
    [days, "d"],
    [hours, "h"],
    [minutes, "m"],
    [seconds, "s"],
  ] as const;
  const firstNonZero = segments.findIndex(([value]) => value > 0);
  if (firstNonZero === -1) return "0s";
  return segments
    .slice(firstNonZero)
    .map(([value, unit]) => `${value}${unit}`)
    .join(" ");
}

export function RoundCountdown({ endsAt }: { endsAt: string }) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(target)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (Number.isNaN(target)) return null;

  const remaining = target - now;
  if (remaining <= 0) {
    return (
      <span className="text-sm text-destructive" data-testid="round-expired">
        expired
      </span>
    );
  }
  return (
    <span className="text-sm text-muted-foreground" data-testid="round-countdown">
      closes in {parts(remaining)}
    </span>
  );
}
