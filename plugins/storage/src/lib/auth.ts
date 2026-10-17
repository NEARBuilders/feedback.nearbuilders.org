/**
 * Auth context types and Better-Auth plugin client factory for the API.
 *
 * BE CAREFUL MODIFYING THIS FILE — changes will be overwritten by `bos sync` / `bos upgrade`.
 * Prefer upstream changes at https://github.com/nearbuilders/everything-dev
 */

import type { DecoratedMiddleware } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import type { z } from "zod";
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

type OrgMetaType<TSchema extends z.ZodType | undefined> = TSchema extends z.ZodType
  ? z.infer<TSchema>
  : Record<string, unknown>;

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

function parseOrgMetadata<TSchema extends z.ZodType | undefined>(
  raw: Record<string, unknown> | null | undefined,
  schema: TSchema | undefined,
): OrgMetaType<TSchema> | null {
  if (!raw) return null;
  if (!schema) return raw as OrgMetaType<TSchema>;
  const result = schema.safeParse(raw);
  if (result.success) return result.data as OrgMetaType<TSchema>;
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: "Invalid organization metadata",
    data: { errors: result.error.issues },
  });
}

export { createAuthMiddleware } from "everything-dev/api";
