import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@/components";
import { formatRelativeTime, formatUnreadCount, notificationTarget } from "@/lib/notifications";
import { roundParams } from "@/lib/round-links";
import { useNearAccountStatus } from "@/lib/use-near-account";

const NOTIFICATIONS_KEY = ["notifications"] as const;
const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { accountId } = useNearAccountStatus();

  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => apiClient.listNotifications({ limit: 30 }),
    enabled: !!accountId,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  const readMutation = useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead({ id }),
    onSuccess: () => void invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => void invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!accountId) return null;

  const items = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;
  const badge = formatUnreadCount(unreadCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          data-testid="notification-bell"
        >
          <Bell className="h-4 w-4" />
          {badge && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
              data-testid="notification-unread-count"
            >
              {badge}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <Button
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0 || readAllMutation.isPending}
            onClick={() => readAllMutation.mutate()}
          >
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-96 overflow-y-auto">
          {query.isLoading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-12 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <p className="p-4 text-sm text-muted-foreground">Couldn't load notifications.</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul>
              {items.map((item) => {
                const unread = item.readAt === null;
                return (
                  <li key={item.id} className="border-b border-border last:border-b-0">
                    <DropdownMenuItem
                      asChild
                      onSelect={() => {
                        if (unread) readMutation.mutate(item.id);
                      }}
                    >
                      <Link
                        to={notificationTarget(item.kind)}
                        params={roundParams(item)}
                        className="flex cursor-pointer gap-2.5 rounded-none px-3 py-2.5"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            unread ? "bg-primary" : "bg-transparent"
                          }`}
                        />
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span
                            className={`block truncate text-sm ${
                              unread ? "font-semibold text-foreground" : "text-foreground"
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.body && (
                            <span className="line-clamp-2 block text-xs text-muted-foreground">
                              {item.body}
                            </span>
                          )}
                          <span className="block text-[11px] text-muted-foreground">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
