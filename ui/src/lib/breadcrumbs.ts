export interface Crumb {
  label: string;
  href: string;
}

const STATIC_LABELS: Record<string, string> = {
  "how-to-integrate": "how it works",
  "feed/request": "request a round",
  "settings/api-keys": "api keys",
  "settings/auth-methods": "sign-in methods",
};

const ROUND_SECTIONS = new Set(["projects", "manage", "testing"]);
const CONSOLE_TABS = new Set(["participants", "broadcast", "settings", "close"]);

interface BreadcrumbOptions {
  /** Resolves an organization slug to its display name. */
  orgName?: (slug: string) => string | undefined;
}

export function getBreadcrumbs(pathname: string, options: BreadcrumbOptions = {}): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);

  return segments.map((segment, index) => {
    const path = segments.slice(0, index + 1).join("/");
    const href = `/${path}`;
    const decoded = safeDecode(segment);

    if (STATIC_LABELS[path]) return { label: STATIC_LABELS[path], href };
    if (segments[0] === "orgs" && index === 1) {
      return { label: options.orgName?.(decoded) ?? decoded, href };
    }
    if (ROUND_SECTIONS.has(segments[0] ?? "") && index === 2) {
      return { label: `round ${decoded}`, href };
    }
    if (segments[0] === "manage" && index === 3 && !CONSOLE_TABS.has(decoded)) {
      return { label: "feedback", href };
    }
    return { label: decoded, href };
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
