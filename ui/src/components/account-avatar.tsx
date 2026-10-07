import { useQuery } from "@tanstack/react-query";
import { useAuthClient } from "@/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components";
import { getNearInitials, resolveNearImageUrl } from "@/lib/near-profile";
import { nearProfileQueryOptions } from "@/lib/queries/profiles";
import { cn } from "@/lib/utils";

export function AccountAvatar({ accountId, className }: { accountId: string; className?: string }) {
  const authClient = useAuthClient();
  const { data: profile } = useQuery(nearProfileQueryOptions(authClient, accountId));
  return (
    <Avatar className={cn("h-7 w-7 border-2 border-background", className)} title={accountId}>
      <AvatarImage src={resolveNearImageUrl(profile?.image)} alt="" />
      <AvatarFallback className="text-[10px]">
        {getNearInitials(profile?.name || accountId)}
      </AvatarFallback>
    </Avatar>
  );
}
