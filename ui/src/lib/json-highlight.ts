export function highlightJson(json: string): string {
  return json.replace(
    /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (_match, key, str, bool, num) => {
      if (key) return `<span class="text-brand-cobalt">${key}</span>:`;
      if (str) return `<span class="text-brand-cyan">${str}</span>`;
      if (bool) return `<span class="text-destructive">${bool}</span>`;
      if (num) return `<span class="text-brand-cobalt">${num}</span>`;
      return "";
    },
  );
}
