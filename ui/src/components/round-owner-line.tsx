import { Link } from "@tanstack/react-router";
import { AccountAvatar } from "@/components/account-avatar";

export function RoundOwnerLine({ ownerAccountId }: { ownerAccountId: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="round-owner">
      <AccountAvatar accountId={ownerAccountId} className="h-6 w-6" />
      <span className="text-sm text-muted-foreground">run by</span>
      <Link
        to="/$accountId"
        params={{ accountId: ownerAccountId }}
        className="font-mono text-sm text-foreground hover:underline"
      >
        {ownerAccountId}
      </Link>
    </div>
  );
}
