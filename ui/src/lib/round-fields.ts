export type RoundFormat = "written" | "recorded" | "issues";

export interface RoundFields {
  title: string;
  description: string;
  readme: string;
  /** Storage-plugin public URL of an uploaded banner image; empty string when none. */
  bannerUrl: string;
  formats: RoundFormat[];
  repoUrl: string;
  /** Private feedback: readable only by the managing org/team, admins and each author (#101). */
  isPrivate: boolean;
  /** Only holders of a Legion SBT can join and post (#103). */
  legionOnly: boolean;
  /** Contact admins can reach for diligence (telegram/email/URL); stored on the project. */
  contact: string;
}

export const EMPTY_ROUND_FIELDS: RoundFields = {
  title: "",
  description: "",
  readme: "",
  bannerUrl: "",
  formats: [],
  repoUrl: "",
  isPrivate: false,
  legionOnly: false,
  contact: "",
};

export const FORMAT_OPTIONS: Array<{ value: RoundFormat; label: string; hint: string }> = [
  { value: "written", label: "Written feedback", hint: "Testers write up what they found." },
  { value: "recorded", label: "Recorded session", hint: "Testers share a recording link." },
  { value: "issues", label: "GitHub issues", hint: "Testers file issues on your repo." },
];

/**
 * What owners can pick today: recorded sessions and GitHub issues are hidden
 * until they ship, but stay in FORMAT_OPTIONS so existing rounds keep working
 * and re-enabling is a filter change.
 */
export const SELECTABLE_FORMAT_OPTIONS = FORMAT_OPTIONS.filter(
  (option) => option.value === "written",
);

export const FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  FORMAT_OPTIONS.map((option) => [option.value, option.label]),
);

export function roundFieldsComplete(fields: RoundFields): boolean {
  return (
    !!fields.title.trim() &&
    !!fields.description.trim() &&
    fields.formats.length > 0 &&
    (!fields.formats.includes("issues") || !!fields.repoUrl.trim())
  );
}

export function nextRoundFields(
  previous:
    | (Omit<RoundFields, "repoUrl" | "contact" | "bannerUrl"> & {
        repoUrl: string | null;
        contact?: string;
        bannerUrl?: string | null;
      })
    | null,
): RoundFields {
  if (!previous) return { ...EMPTY_ROUND_FIELDS, formats: ["written"] };
  return {
    title: previous.title,
    description: previous.description,
    readme: previous.readme,
    bannerUrl: previous.bannerUrl ?? "",
    formats: previous.formats,
    repoUrl: previous.repoUrl ?? "",
    isPrivate: previous.isPrivate,
    legionOnly: previous.legionOnly,
    contact: previous.contact ?? "",
  };
}

export function toCreateRoundInput(fields: RoundFields) {
  return {
    title: fields.title.trim(),
    description: fields.description.trim(),
    readme: fields.readme.trim() || undefined,
    bannerUrl: fields.bannerUrl.trim() || undefined,
    formats: fields.formats,
    repoUrl: fields.repoUrl.trim() || undefined,
    isPrivate: fields.isPrivate || undefined,
    legionOnly: fields.legionOnly || undefined,
    contact: fields.contact.trim() || undefined,
  };
}
