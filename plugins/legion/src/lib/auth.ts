/**
 * Auth context types and Better-Auth plugin client factory for the API.
 *
 * BE CAREFUL MODIFYING THIS FILE — changes will be overwritten by `bos sync` / `bos upgrade`.
 * Prefer upstream changes at https://github.com/nearbuilders/everything-dev
 */

import type {
  AuthOrganizationContext,
  AuthOrganizationSummary,
  AuthPluginContext,
} from "./auth-types.gen";

export type * from "./auth-types.gen";

export type AuthContext = AuthPluginContext;
export type RequestAuthUser = NonNullable<AuthContext["user"]>;
export type ApiKeyContext = NonNullable<AuthContext["apiKey"]>;

export interface AuthenticatedContext extends AuthContext {
  userId: string;
  user: RequestAuthUser;
}

export type OrgAuthenticatedContext<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = AuthenticatedContext & {
  organization: NonNullable<AuthOrganizationContext> & {
    activeOrganizationId: string;
    organization: (AuthOrganizationSummary & { metadata: TMeta | null }) | null;
  };
};

export type OrgMemberAuthenticatedContext<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = AuthenticatedContext & {
  organization: NonNullable<AuthOrganizationContext> & {
    activeOrganizationId: string;
    member: NonNullable<AuthOrganizationContext["member"]>;
    organization: (AuthOrganizationSummary & { metadata: TMeta | null }) | null;
  };
};

export { createAuthMiddleware } from "everything-dev/api";
