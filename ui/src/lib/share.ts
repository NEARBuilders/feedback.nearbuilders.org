import { toast } from "sonner";

export function absoluteUrl(href: string): string {
  return new URL(href, window.location.origin).toString();
}

export async function copyUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
  toast.success("Link copied");
}

export async function shareUrl({ title, url }: { title: string; url: string }): Promise<void> {
  try {
    await navigator.share({ title, url });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) await copyUrl(url);
  }
}
