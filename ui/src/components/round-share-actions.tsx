import { Link2, Share2 } from "lucide-react";
import { Button } from "@/components";
import { useClientValue } from "@/hooks";
import { type RoundRef, roundHref } from "@/lib/round-links";
import { absoluteUrl, copyUrl, shareUrl } from "@/lib/share";

function canonicalUrl(round: RoundRef) {
  return absoluteUrl(roundHref(round));
}

async function copyLink(round: RoundRef) {
  await copyUrl(canonicalUrl(round));
}

async function share(round: RoundRef & { title: string }) {
  await shareUrl({ title: round.title, url: canonicalUrl(round) });
}

export function RoundShareActions({ round }: { round: RoundRef & { title: string } }) {
  const canShare = useClientValue(() => typeof navigator.share === "function", false);
  return (
    <div className="flex gap-2">
      {canShare && (
        <Button variant="outline" size="sm" onClick={() => void share(round)}>
          <Share2 className="h-3.5 w-3.5" />
          share
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => void copyLink(round)}>
        <Link2 className="h-3.5 w-3.5" />
        copy link
      </Button>
    </div>
  );
}
