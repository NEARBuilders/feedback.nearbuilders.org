import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Organization } from "@/app";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { getNearInitials, resolveNearImageUrl } from "@/lib/near-profile";
import { nearProfileQueryOptions } from "@/lib/queries/profiles";
import { useNearAccount } from "@/lib/use-near-account";

export function useIdentity() {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const sessionQuery = useQuery(sessionQueryOptions(auth));
  const session = sessionQuery.data;
  const user = session?.user;
  const nearAccountId = useNearAccount();

  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
    enabled: !!user,
  });
  const activeOrgId = session?.session?.activeOrganizationId;

  const activeOrg = useMemo(() => {
    return organizations?.find((org) => org.id === activeOrgId);
  }, [organizations, activeOrgId]);

  const { data: nearProfile } = useQuery(nearProfileQueryOptions(auth, nearAccountId ?? null));

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.signOut();
      if (error) {
        throw new Error(error.message || "Failed to sign out");
      }
      await auth.near.disconnect().catch(() => {});
    },
    onSuccess: async () => {
      queryClient.setQueryData(["session"], null);
      queryClient.removeQueries({ queryKey: ["organizations"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await router.invalidate();
      await navigate({ to: "/", replace: true });
    },
    onError: (error: Error) => {
      console.error("Sign out error:", error);
    },
  });

  const avatarSrc = resolveNearImageUrl(nearProfile?.image) ?? user?.image ?? undefined;
  const validEmail = user && !user.isAnonymous && user.email ? user.email : null;
  const displayName = nearProfile?.name || user?.name || nearAccountId || validEmail || "guest";
  const handle = nearAccountId || validEmail || "anonymous session";
  const showHandle = handle !== displayName;
  const initials = getNearInitials(nearProfile?.name || user?.name || nearAccountId);

  return {
    user,
    session,
    isSessionLoading: sessionQuery.isLoading,
    nearAccountId,
    organizations: organizations ?? [],
    activeOrgId,
    activeOrg,
    nearProfile,
    signOutMutation,
    avatarSrc,
    validEmail,
    displayName,
    handle,
    showHandle,
    initials,
  };
}
