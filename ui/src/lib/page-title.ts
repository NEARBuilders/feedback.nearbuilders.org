const SITE_TITLE = "Feedback Rounds";

export function pageTitle(title?: string): string {
  return title ? `${title} | ${SITE_TITLE}` : SITE_TITLE;
}

export function pageHead(title?: string, description?: string) {
  return {
    meta: [
      { title: pageTitle(title) },
      ...(description ? [{ name: "description", content: description }] : []),
    ],
  };
}
