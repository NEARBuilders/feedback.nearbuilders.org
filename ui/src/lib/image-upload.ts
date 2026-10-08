/** Mirrors the storage plugin's defaults so oversized or disallowed files fail before upload (#108). */
export const IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Why a file can't be uploaded as a feedback image, or null when it can. */
export function imageRejection(file: { type: string; size: number; name: string }): string | null {
  if (!(IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return `${file.name} isn't a PNG, JPEG, WebP or GIF image`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is over the ${MAX_IMAGE_BYTES / (1024 * 1024)} MB limit`;
  }
  return null;
}

/** Splits files into the ones to upload and a message for each one that can't be. */
export function partitionImages<T extends { type: string; size: number; name: string }>(
  files: T[],
): { accepted: T[]; rejected: string[] } {
  const accepted: T[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const reason = imageRejection(file);
    if (reason) rejected.push(reason);
    else accepted.push(file);
  }
  return { accepted, rejected };
}

/** The alt text for an image: its file name without the extension, kept markdown-safe. */
export function imageAltText(filename: string): string {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[[\]()]/g, " ")
      .trim() || "image"
  );
}

export function imageMarkdown(filename: string, url: string): string {
  return `![${imageAltText(filename)}](${url})`;
}

/** Inserts `insertion` over the selection, on its own line, and returns the new text and caret. */
export function insertAtSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  insertion: string,
): { text: string; caret: number } {
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);
  const lead = before && !before.endsWith("\n") ? "\n" : "";
  const trail = after && !after.startsWith("\n") ? "\n" : "";
  const inserted = `${lead}${insertion}${trail}`;
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

/** The uploaded images whose URL is still in the body, so abandoned uploads aren't attached. */
export function imagesStillInBody<T extends { url: string }>(body: string, uploaded: T[]): T[] {
  return uploaded.filter((image) => body.includes(image.url));
}
