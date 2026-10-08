import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { BannerUploader } from "@/components/banner-uploader";
import { SectionHeader } from "@/components/layout/section-header";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import type { RoundDetail } from "@/lib/round-route";

export function RoundBannerForm({ round }: { round: RoundDetail }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [bannerUrl, setBannerUrl] = useState(round.bannerUrl ?? "");

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateRound({ id: round.id, bannerUrl: bannerUrl.trim() || null }),
    onSuccess: () => {
      void invalidateRoundQueries(queryClient);
      toast.success("Banner saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unchanged = (bannerUrl.trim() || null) === (round.bannerUrl ?? null);

  return (
    <Card className="space-y-4 p-5" data-testid="round-banner-form">
      <SectionHeader title="Banner" />
      <BannerUploader value={bannerUrl} onChange={setBannerUrl} disabled={saveMutation.isPending} />
      <Button onClick={() => saveMutation.mutate()} disabled={unchanged || saveMutation.isPending}>
        {saveMutation.isPending ? "saving..." : "save banner"}
      </Button>
    </Card>
  );
}
