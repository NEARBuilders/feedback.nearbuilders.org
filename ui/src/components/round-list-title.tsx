import { roundListTitle } from "@/lib/round-title";

export function RoundListTitle({
  title,
  projectRoundNumber,
}: {
  title: string;
  projectRoundNumber: number;
}) {
  const { prefix, label } = roundListTitle(title, projectRoundNumber);
  return (
    <>
      {prefix ? <span className="text-muted-foreground">{prefix}</span> : null}
      {prefix ? " " : null}
      {label}
    </>
  );
}
