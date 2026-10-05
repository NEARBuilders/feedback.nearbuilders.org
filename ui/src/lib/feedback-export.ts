export type FeedbackStatus = "unresolved" | "resolved" | "dismissed";

export type FeedbackStatusFilter = "all" | FeedbackStatus;

export interface ExportableFeedback {
  id: string;
  authorAccountId: string;
  format: "written" | "recorded";
  body: string | null;
  url: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

const CSV_COLUMNS = ["id", "author", "format", "content", "status", "createdAt"] as const;

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function contentOf(entry: ExportableFeedback): string {
  return (entry.format === "written" ? entry.body : entry.url) ?? "";
}

export function filterFeedbackByStatus<T extends { status: FeedbackStatus }>(
  entries: T[],
  filter: FeedbackStatusFilter,
): T[] {
  return filter === "all" ? entries : entries.filter((entry) => entry.status === filter);
}

export function feedbackToCsv(entries: ExportableFeedback[]): string {
  const rows = entries.map((entry) =>
    [entry.id, entry.authorAccountId, entry.format, contentOf(entry), entry.status, entry.createdAt]
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
      content: contentOf(entry),
      status: entry.status,
      createdAt: entry.createdAt,
    })),
    null,
    2,
  );
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
