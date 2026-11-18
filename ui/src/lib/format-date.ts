const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | number | Date): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "";
}

export function formatDateTime(value: string | number | Date): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "";
}

export function formatCount(value: number): string {
  return numberFormatter.format(value);
}
