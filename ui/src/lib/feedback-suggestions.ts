interface SuggestionShape {
  status: "resolved" | "dismissed" | null;
  star: boolean;
}

/** A short label for what an agent suggests, such as "resolve", "dismiss" or "resolve + star". */
export function describeSuggestion({ status, star }: SuggestionShape): string {
  const parts: string[] = [];
  if (status === "resolved") parts.push("resolve");
  if (status === "dismissed") parts.push("dismiss");
  if (star) parts.push("star");
  return parts.join(" + ");
}

/** The first line of a piece of feedback, trimmed for a list. Images and markdown are dropped. */
export function snippet(text: string, max = 120): string {
  const flat = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
