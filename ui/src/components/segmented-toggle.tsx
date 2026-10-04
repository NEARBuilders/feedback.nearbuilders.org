import type { ReactNode } from "react";

interface SegmentedToggleProps<T extends string> {
  value: T | null;
  onValueChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  disabled?: boolean;
  ariaLabel?: string;
}

export function SegmentedToggle<T extends string>({
  value,
  onValueChange,
  options,
  disabled,
  ariaLabel,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-border bg-card p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          disabled={disabled}
          onClick={() => onValueChange(option.value)}
          className={`h-8 px-3 text-sm font-medium rounded-[8px] transition-colors disabled:opacity-50 ${
            value === option.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
