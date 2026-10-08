import { cn } from "@/lib/utils";

const LEGION_LOGO_URL = "https://nearlegion.com/assets/brand/logo.webp";

/**
 * The Legion brand mark, for flagging Legion-gated rounds. Decorative: the
 * surrounding text (badge or title attribute) carries the meaning.
 */
export function LegionMark({ className, title }: { className?: string; title?: string }) {
  return (
    <img
      src={LEGION_LOGO_URL}
      alt=""
      aria-hidden="true"
      title={title}
      className={cn("h-3.5 w-3.5 shrink-0 rounded-full", className)}
    />
  );
}
