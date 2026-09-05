import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient, useAuthClient } from "@/app";
import { Button, Card, CardContent, Field, FieldLabel, Input, Textarea } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_layout/_authenticated/feedback/request")({
  head: () => ({
    meta: [
      { title: "Request a Feedback Round" },
      { name: "description", content: "Ask builders to test your project and share feedback." },
    ],
  }),
  component: RequestRoundPage,
});

const FORMAT_OPTIONS = [
  {
    value: "written" as const,
    label: "Written feedback",
    hint: "Testers write up what they found.",
  },
  {
    value: "recorded" as const,
    label: "Recorded session",
    hint: "Testers share a recording link.",
  },
  { value: "issues" as const, label: "GitHub issues", hint: "Testers file issues on your repo." },
];

function RequestRoundPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const navigate = useNavigate();
  const nearAccountId = auth.near.getAccountId();

  const [projectSlug, setProjectSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formats, setFormats] = useState<Array<"issues" | "written" | "recorded">>([]);
  const [repoUrl, setRepoUrl] = useState("");

  const toggleFormat = (value: "issues" | "written" | "recorded") => {
    setFormats((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
    );
  };

  const needsRepoUrl = formats.includes("issues");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createRound({
        projectSlug: projectSlug.trim(),
        title: title.trim(),
        description: description.trim(),
        formats,
        repoUrl: repoUrl.trim() || undefined,
      }),
    onSuccess: (round) => {
      toast.success("Round is live");
      void navigate({ to: "/feedback/$roundId", params: { roundId: round.id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit =
    !!nearAccountId &&
    !!projectSlug.trim() &&
    !!title.trim() &&
    !!description.trim() &&
    formats.length > 0 &&
    (!needsRepoUrl || !!repoUrl.trim());

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles size={14} />
            <span>Request</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Request a feedback round</h1>
          <p className="text-sm text-muted-foreground">
            It goes live for builders to join as soon as you submit — no approval step.
          </p>
        </header>

        {!nearAccountId && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Link a NEAR account before requesting a round.{" "}
              <Link to="/settings/auth-methods" className="underline text-foreground">
                Link one now
              </Link>
              .
            </p>
          </Card>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-6"
        >
          <Card>
            <CardContent className="p-6 space-y-4">
              <Field>
                <FieldLabel htmlFor="round-project">project</FieldLabel>
                <Input
                  id="round-project"
                  value={projectSlug}
                  onChange={(e) => setProjectSlug(e.target.value)}
                  placeholder="your-project-slug"
                  required
                  disabled={createMutation.isPending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="round-title">title</FieldLabel>
                <Input
                  id="round-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Try the new onboarding flow"
                  required
                  disabled={createMutation.isPending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="round-description">what needs testing</FieldLabel>
                <Textarea
                  id="round-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="What should testers focus on?"
                  required
                  disabled={createMutation.isPending}
                />
              </Field>

              <Field>
                <FieldLabel>feedback formats</FieldLabel>
                <div className="space-y-2.5 mt-1">
                  {FORMAT_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-2.5 cursor-pointer"
                      htmlFor={`format-${option.value}`}
                    >
                      <Checkbox
                        id={`format-${option.value}`}
                        checked={formats.includes(option.value)}
                        onCheckedChange={() => toggleFormat(option.value)}
                        disabled={createMutation.isPending}
                      />
                      <span className="text-sm">
                        <span className="text-foreground font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="round-repo">
                  repo url{needsRepoUrl ? " (required for GitHub issues)" : " (optional)"}
                </FieldLabel>
                <Input
                  id="round-repo"
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  required={needsRepoUrl}
                  disabled={createMutation.isPending}
                />
              </Field>
            </CardContent>
          </Card>

          <Button type="submit" disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? "Requesting..." : "Request round"}
          </Button>
        </form>
      </div>
    </PageContainer>
  );
}
