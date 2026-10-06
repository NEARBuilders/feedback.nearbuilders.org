import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, Checkbox, Label } from "@/components";
import { SectionHeader } from "@/components/layout/section-header";
import { FORMAT_LABELS } from "@/components/rounds-table";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import type { RoundDetail } from "@/lib/round-route";

type RoundFormat = RoundDetail["formats"][number];

const FORMATS: RoundFormat[] = ["written", "recorded", "issues"];

export function RoundFormatsForm({ round }: { round: RoundDetail }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [formats, setFormats] = useState<RoundFormat[]>(round.formats);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateRound({ id: round.id, formats }),
    onSuccess: () => {
      void invalidateRoundQueries(queryClient);
      toast.success("Formats saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = (format: RoundFormat, checked: boolean) =>
    setFormats((prev) =>
      checked
        ? FORMATS.filter((f) => f === format || prev.includes(f))
        : prev.filter((f) => f !== format),
    );
  const unchanged = formats.join() === round.formats.join();

  return (
    <Card className="p-5 space-y-4" data-testid="round-formats">
      <SectionHeader title="Feedback formats" />
      <div className="space-y-3">
        {FORMATS.map((format) => {
          const disabled = format === "issues" && !round.repoUrl;
          return (
            <div key={format} className="flex items-center gap-2">
              <Checkbox
                id={`format-${format}`}
                checked={formats.includes(format)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(format, checked === true)}
              />
              <Label htmlFor={`format-${format}`} className={disabled ? "opacity-60" : undefined}>
                {FORMAT_LABELS[format]}
                {disabled && " (needs a repo URL)"}
              </Label>
            </div>
          );
        })}
      </div>
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={unchanged || formats.length === 0 || saveMutation.isPending}
      >
        {saveMutation.isPending ? "Saving..." : "Save formats"}
      </Button>
    </Card>
  );
}
