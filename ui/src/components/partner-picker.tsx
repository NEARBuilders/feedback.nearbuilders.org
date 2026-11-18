export interface PartnerSuggestion {
  slug: string;
  name: string | null;
  active: boolean;
}

interface PartnerPickerProps {
  suggestions: PartnerSuggestion[];
  /** Slugs the creator unchecked; everything suggested starts checked. */
  uncheckedSlugs: ReadonlySet<string>;
  onToggle: (slug: string) => void;
}

export function PartnerPicker({ suggestions, uncheckedSlugs, onToggle }: PartnerPickerProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="partner-picker">
      <p className="text-sm font-medium text-foreground">partners</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Partner organizations co-manage this round with your organization, private feedback
        included. You can add or remove them later.
      </p>
      <ul className="space-y-1">
        {suggestions.map((suggestion) => {
          const checked = !uncheckedSlugs.has(suggestion.slug);
          return (
            <li key={suggestion.slug}>
              <label
                className={`flex items-center gap-2 text-sm ${
                  suggestion.active ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid={`partner-picker-option-${suggestion.slug}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!suggestion.active}
                  onChange={() => onToggle(suggestion.slug)}
                  className="h-4 w-4 accent-primary"
                  data-testid={`partner-picker-checkbox-${suggestion.slug}`}
                />
                <span>
                  {suggestion.name ?? `@${suggestion.slug}`}
                  <span className="text-muted-foreground"> @{suggestion.slug}</span>
                </span>
                {!suggestion.active && <span className="text-xs">(not approved yet)</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
