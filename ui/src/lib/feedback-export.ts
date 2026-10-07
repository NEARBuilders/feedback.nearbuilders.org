import type { FeedbackEntry } from "@/lib/queries/feedback";

export type ExportableFeedback = Pick<
  FeedbackEntry,
  "id" | "authorAccountId" | "format" | "body" | "url" | "status" | "createdAt"
>;

const CSV_COLUMNS = ["id", "author", "format", "content", "status", "createdAt"] as const;

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function feedbackText(entry: Pick<ExportableFeedback, "format" | "body" | "url">): string {
  return (entry.format === "written" ? entry.body : entry.url) ?? "";
}

export function feedbackToCsv(entries: ExportableFeedback[]): string {
  const rows = entries.map((entry) =>
    [
      entry.id,
      entry.authorAccountId,
      entry.format,
      feedbackText(entry),
      entry.status,
      entry.createdAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}

export function feedbackToJson(entries: ExportableFeedback[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      id: entry.id,
      author: entry.authorAccountId,
      format: entry.format,
      content: feedbackText(entry),
      status: entry.status,
      createdAt: entry.createdAt,
    })),
    null,
    2,
  );
}

export function exportFeedback(kind: "csv" | "json", name: string, entries: ExportableFeedback[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === "csv") {
    downloadTextFile(`${name}-${stamp}.csv`, feedbackToCsv(entries), "text/csv");
  } else {
    downloadTextFile(`${name}-${stamp}.json`, feedbackToJson(entries), "application/json");
  }
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
