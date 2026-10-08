import { Checkbox, Field, FieldLabel, Input, MarkdownEditor, Textarea } from "@/components";
import { FORMAT_OPTIONS, type RoundFields, type RoundFormat } from "@/lib/round-fields";

interface FormatCheckboxesProps {
  value: RoundFormat[];
  onChange: (formats: RoundFormat[]) => void;
  disabled?: boolean;
  issuesDisabled?: boolean;
}

export function FormatCheckboxes({
  value,
  onChange,
  disabled,
  issuesDisabled,
}: FormatCheckboxesProps) {
  const toggle = (format: RoundFormat, checked: boolean) =>
    onChange(
      FORMAT_OPTIONS.map((option) => option.value).filter((f) =>
        f === format ? checked : value.includes(f),
      ),
    );

  return (
    <div className="space-y-2.5">
      {FORMAT_OPTIONS.map((option) => {
        const optionDisabled = disabled || (option.value === "issues" && issuesDisabled);
        return (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2.5"
            htmlFor={`format-${option.value}`}
          >
            <Checkbox
              id={`format-${option.value}`}
              checked={value.includes(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
              disabled={optionDisabled}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">{option.label}</span>
              <span className="block text-xs text-muted-foreground">
                {option.value === "issues" && issuesDisabled ? "Needs a repo URL." : option.hint}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

interface RoundFieldsEditorProps {
  value: RoundFields;
  onChange: (fields: RoundFields) => void;
  disabled?: boolean;
}

export function RoundFieldsEditor({ value, onChange, disabled }: RoundFieldsEditorProps) {
  const set = <K extends keyof RoundFields>(key: K, next: RoundFields[K]) =>
    onChange({ ...value, [key]: next });
  const needsRepoUrl = value.formats.includes("issues");

  return (
    <>
      <Field>
        <FieldLabel htmlFor="round-title">title</FieldLabel>
        <Input
          id="round-title"
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Try the new onboarding flow"
          required
          disabled={disabled}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="round-description">what needs testing</FieldLabel>
        <Textarea
          id="round-description"
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          rows={5}
          placeholder="What should testers focus on?"
          required
          disabled={disabled}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="round-readme">readme for testers (optional, markdown)</FieldLabel>
        <MarkdownEditor
          id="round-readme"
          value={value.readme}
          onChange={(readme) => set("readme", readme)}
          maxLength={20000}
          aria-label="Readme markdown"
          disabled={disabled}
        />
      </Field>

      <Field>
        <FieldLabel>feedback formats</FieldLabel>
        <FormatCheckboxes
          value={value.formats}
          onChange={(formats) => set("formats", formats)}
          disabled={disabled}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="round-repo">
          repo url{needsRepoUrl ? " (required for GitHub issues)" : " (optional)"}
        </FieldLabel>
        <Input
          id="round-repo"
          type="url"
          value={value.repoUrl}
          onChange={(e) => set("repoUrl", e.target.value)}
          placeholder="https://github.com/org/repo"
          required={needsRepoUrl}
          disabled={disabled}
        />
      </Field>

      <Field>
        <FieldLabel>access</FieldLabel>
        <div className="mt-1 space-y-2.5">
          <label className="flex cursor-pointer items-start gap-2.5" htmlFor="round-private">
            <Checkbox
              id="round-private"
              checked={value.isPrivate}
              onCheckedChange={(checked) => set("isPrivate", checked === true)}
              disabled={disabled}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Private feedback</span>
              <span className="block text-xs text-muted-foreground">
                Only your organization (or its managing team), platform admins and each author can
                read submissions.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5" htmlFor="round-legion-only">
            <Checkbox
              id="round-legion-only"
              checked={value.legionOnly}
              onCheckedChange={(checked) => set("legionOnly", checked === true)}
              disabled={disabled}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Legion members only</span>
              <span className="block text-xs text-muted-foreground">
                Only holders of a Legion SBT can join and post.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5" htmlFor="round-anonymous">
            <Checkbox
              id="round-anonymous"
              checked={value.allowAnonymous}
              onCheckedChange={(checked) => set("allowAnonymous", checked === true)}
              disabled={disabled || value.legionOnly}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Allow anonymous feedback</span>
              <span className="block text-xs text-muted-foreground">
                Anyone can post without joining or signing in, with no identity attached. Anonymous
                posts earn no points or credit, and can't be used on Legion-only rounds.
              </span>
            </span>
          </label>
        </div>
      </Field>
    </>
  );
}
