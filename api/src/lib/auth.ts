/**
 * Auth context types and middleware factory for the API.
 *
 * BE CAREFUL MODIFYING THIS FILE — changes will be overwritten by `bos sync` / `bos upgrade`.
 * Prefer upstream changes at https://github.com/nearbuilders/everything-dev
 */

export { createAuthMiddleware } from "everything-dev/api";

export type * from "./auth-types.gen";

export type AuthContext = import("./auth-types.gen").AuthPluginContext;
export type RequestAuthUser = NonNullable<AuthContext["user"]>;
export type ApiKeyContext = NonNullable<AuthContext["apiKey"]>;

export interface AuthenticatedContext extends AuthContext {
  userId: string;
  user: RequestAuthUser;
}
