import { Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components";
import { type RoundRef, roundHref } from "@/lib/round-links";

function canonicalUrl(round: RoundRef) {
  return new URL(roundHref(round), window.location.origin).toString();
}

async function copyLink(round: RoundRef) {
  await navigator.clipboard.writeText(canonicalUrl(round));
  toast.success("Link copied");
}

async function share(round: RoundRef & { title: string }) {
  if (typeof navigator.share !== "function") return copyLink(round);
  try {
    await navigator.share({ title: round.title, url: canonicalUrl(round) });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) await copyLink(round);
  }
}

export function RoundShareActions({ round }: { round: RoundRef & { title: string } }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => void share(round)}>
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>
      <Button variant="outline" size="sm" onClick={() => void copyLink(round)}>
        <Link2 className="h-3.5 w-3.5" />
        Copy link
      </Button>
    </div>
  );
}
