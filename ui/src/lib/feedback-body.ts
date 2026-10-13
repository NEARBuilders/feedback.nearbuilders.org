export const FEEDBACK_TEXT_MAX = 30000;

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
const NBSP = /&nbsp;/gi;
const BLOCK_PREFIX =
  /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+)/gm;
const CODE_FENCE = /^[ \t]*(?:```|~~~).*$/gm;
const INLINE_MARKERS = /(?<!\\)(?:\*\*|__|~~|`)/g;
const ESCAPE = /\\([\\`*_{}[\]()#+\-.!|~<>])/g;
const BLANK_LINES = /\n{2,}/g;

/**
 * Length of a markdown body as the reader sees it: images, link URLs and markdown syntax
 * don't count. Keep in sync with api/src/lib/feedback-body.ts.
 */
export function feedbackTextLength(body: string): number {
  return body
    .replace(MARKDOWN_IMAGE, "")
    .replace(MARKDOWN_LINK, "$1")
    .replace(AUTOLINK, "$1")
    .replace(NBSP, " ")
    .replace(CODE_FENCE, "")
    .replace(BLOCK_PREFIX, "")
    .replace(INLINE_MARKERS, "")
    .replace(ESCAPE, "$1")
    .replace(BLANK_LINES, "\n")
    .trim().length;
}

/**
 * True when an image is still embedded as file data instead of an uploaded URL: an upload
 * that failed or hasn't finished. Posting it would store the whole image in the body.
 */
export function hasUnuploadedImage(body: string): boolean {
  for (const match of body.matchAll(MARKDOWN_IMAGE)) {
    if (/^(?:data|blob):/i.test(match[2] ?? "")) return true;
  }
  return false;
}
