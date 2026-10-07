import { useQuery } from "@tanstack/react-query";
import { Check, Copy, HandCoins } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button } from "@/components";

/** Looks up a tester's Telegram handle and tip message (#105). Handles rarely change. */
export function useTelegramTip(accountId: string, enabled: boolean) {
  const apiClient = useApiClient();
  return useQuery({
    queryKey: ["telegram-tip", accountId],
    queryFn: () => apiClient.getTelegramTip({ accountId }),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** The tester's Telegram handle, or an explicit "no Telegram linked" state. */
export function TelegramHandle({ accountId, enabled }: { accountId: string; enabled: boolean }) {
  const { data, isLoading } = useTelegramTip(accountId, enabled);
  if (!enabled || isLoading) return null;
  if (data?.handle) {
    return (
      <a
        href={`https://t.me/${data.handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-muted-foreground hover:text-foreground hover:underline"
        data-testid="telegram-handle"
      >
        @{data.handle}
      </a>
    );
  }
  return (
    <span className="block text-xs text-muted-foreground" data-testid="no-telegram">
      {data && !data.available ? "Telegram lookup unavailable" : "no Telegram linked"}
    </span>
  );
}

/** Copy the tip-bot message, or open Telegram with it ready to send. Disabled without a handle. */
export function TipButtons({ accountId }: { accountId: string }) {
  const { data, isLoading } = useTelegramTip(accountId, true);
  const [copied, setCopied] = useState(false);
  const message = data?.message ?? null;
  const shareUrl = data?.shareUrl ?? null;
  const disabledReason = isLoading
    ? "Looking up Telegram handle…"
    : data && !data.available
      ? "Couldn't reach the Telegram handle sources"
      : "No Telegram linked for this tester";

  const copy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success(`Copied "${message}"`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  if (!message || !shareUrl) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label="Tip on Telegram"
        title={disabledReason}
        disabled
      >
        <HandCoins className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Copy tip message"
        title={`Copy "${message}"`}
        onClick={() => void copy()}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Tip on Telegram"
        title="Tip on Telegram"
        onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
      >
        <HandCoins className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
