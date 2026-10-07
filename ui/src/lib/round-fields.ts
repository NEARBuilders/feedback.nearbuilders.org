export type RoundFormat = "written" | "recorded" | "issues";

export interface RoundFields {
  title: string;
  description: string;
  readme: string;
  formats: RoundFormat[];
  repoUrl: string;
  /** Private feedback: readable only by the managing org/team, admins and each author (#101). */
  isPrivate: boolean;
  /** Only holders of a Legion SBT can join and post (#103). */
  legionOnly: boolean;
}

export const EMPTY_ROUND_FIELDS: RoundFields = {
  title: "",
  description: "",
  readme: "",
  formats: [],
  repoUrl: "",
  isPrivate: false,
  legionOnly: false,
};

export const FORMAT_OPTIONS: Array<{ value: RoundFormat; label: string; hint: string }> = [
  { value: "written", label: "Written feedback", hint: "Testers write up what they found." },
  { value: "recorded", label: "Recorded session", hint: "Testers share a recording link." },
  { value: "issues", label: "GitHub issues", hint: "Testers file issues on your repo." },
];

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
  previous: (Omit<RoundFields, "repoUrl"> & { repoUrl: string | null }) | null,
): RoundFields {
  if (!previous) return EMPTY_ROUND_FIELDS;
  return {
    title: previous.title,
    description: previous.description,
    readme: previous.readme,
    formats: previous.formats,
    repoUrl: previous.repoUrl ?? "",
    isPrivate: previous.isPrivate,
    legionOnly: previous.legionOnly,
  };
}

export function toCreateRoundInput(fields: RoundFields) {
  return {
    title: fields.title.trim(),
    description: fields.description.trim(),
    readme: fields.readme.trim() || undefined,
    formats: fields.formats,
    repoUrl: fields.repoUrl.trim() || undefined,
    isPrivate: fields.isPrivate || undefined,
    legionOnly: fields.legionOnly || undefined,
  };
}
