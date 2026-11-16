import { Video } from "lucide-react";
import { Markdown } from "@/components";
import { httpUrl } from "@/lib/http-url";
import type { FeedbackEntry } from "@/lib/queries/feedback";

export function FeedbackContent({
  entry,
}: {
  entry: Pick<FeedbackEntry, "format" | "body" | "url">;
}) {
  if (entry.format === "written") return <Markdown content={entry.body ?? ""} />;
  const url = httpUrl(entry.url);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-foreground underline break-all"
    >
      <Video className="h-4 w-4 shrink-0" />
      {url}
    </a>
  );
}
