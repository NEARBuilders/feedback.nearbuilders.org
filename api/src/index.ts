import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { createAuthMiddleware } from "./lib/auth";
import { ContextSchema } from "./lib/context";
import type { PluginsClient } from "./lib/plugins-types.gen";
import { createActivityEmitter } from "./services/activity-events";
import { createFeedbackNostrEmitter } from "./services/feedback-nostr";
import { createProjectsLookup } from "./services/projects";
import { RoundsLive, RoundsTag } from "./services/rounds";
import { TenantsLive, TenantsTag } from "./services/tenants";

const SUBDOMAIN_SEGMENT_REGEX = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const ACCOUNT_ID_REGEX =
  /^(?=.{2,64}$)([a-z0-9]+(?:[-_][a-z0-9]+)*)(\.([a-z0-9]+(?:[-_][a-z0-9]+)*))*$/;
const RESERVED_SUBDOMAINS = new Set([
  "root",
  "www",
  "admin",
  "api",
  "dashboard",
  "mail",
  "status",
  "help",
  "support",
  "docs",
  "blog",
  "dev",
  "test",
  "app",
  "beta",
  "demo",
  "staging",
  "internal",
  "moderation",
  "abuse",
]);

function validateSubdomain(subdomain: string): void {
  if (!SUBDOMAIN_SEGMENT_REGEX.test(subdomain)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Invalid subdomain format",
      data: { hint: "Lowercase alphanumeric with hyphens or underscores only" },
    });
  }
}

function validateAccountId(accountId: string): void {
  if (!ACCOUNT_ID_REGEX.test(accountId)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Invalid accountId format",
      data: { hint: "Must be a valid NEAR account ID" },
    });
  }
}

export default createPlugin.withPlugins<PluginsClient>()({
  variables: z.object({}),

  secrets: z.object({
    API_DATABASE_URL: z.string().default("pglite:.bos/api/:memory:"),
    // activity.nearbuilders.org producer integration. Both must be set to emit;
    // otherwise event emission is a no-op. See README "Activity events".
    ACTIVITY_API_BASE_URL: z.string().default(""),
    ACTIVITY_API_KEY: z.string().default(""),
    // This app's registered Activity Source id, used to scope leaderboard reads.
    ACTIVITY_SOURCE_ID: z.string().default(""),
    // Hex-encoded secret key for this app's service Nostr identity, used to
    // publish feedback submissions as Nostr comments (#32). Best-effort:
    // publishing is a no-op when unset. See services/feedback-nostr.ts.
    NOSTR_SECRET_KEY_HEX: z.string().default(""),
    // nearbuilders.org API base URL, used to resolve the "request a round" form's
    // project picker against real projects (#23). Read-only, no key required;
    // the picker falls back to free-text entry when unset. See services/projects.ts.
    PROJECTS_API_BASE_URL: z.string().default(""),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, plugins, tools) =>
    Effect.gen(function* () {
      const database = DatabaseLive(config.secrets.API_DATABASE_URL);
      const tenantsLayer = TenantsLive.pipe(Layer.provide(database));
      const roundsLayer = RoundsLive.pipe(Layer.provide(database));

      const tenantsService = yield* tools.buildService(TenantsTag, tenantsLayer);
      const roundsService = yield* tools.buildService(RoundsTag, roundsLayer);

      const activityEvents = createActivityEmitter({
        baseUrl: config.secrets.ACTIVITY_API_BASE_URL,
        apiKey: config.secrets.ACTIVITY_API_KEY,
        sourceId: config.secrets.ACTIVITY_SOURCE_ID,
      });

      const feedbackNostr = createFeedbackNostrEmitter({
        nostr: plugins.nostr,
        secretKeyHex: config.secrets.NOSTR_SECRET_KEY_HEX,
      });

      const projectsLookup = createProjectsLookup({
        baseUrl: config.secrets.PROJECTS_API_BASE_URL,
      });

      console.log(
        `[API] Services Initialized (activity events ${activityEvents.enabled ? "enabled" : "disabled"}, feedback nostr comments ${feedbackNostr.enabled ? "enabled" : "disabled"}, projects lookup ${projectsLookup.enabled ? "enabled" : "disabled"})`,
      );

      return {
        tenants: tenantsService,
        rounds: roundsService,
        activityEvents,
        feedbackNostr,
        projectsLookup,
      };
    }),

  shutdown: () => Effect.log("[API] Shutdown"),

  createRouter: (services, builder) => {
    const { requireAuth, requireOrganization, requireOrgRole } = createAuthMiddleware(builder);

    const authorizedTenant = async (
      input: { tenantId: string },
      context: { organization: { activeOrganizationId: string } },
    ) => {
      const activeOrgId = context.organization.activeOrganizationId;
      const tenant = await services.tenants.resolveTenantById(input.tenantId);
      if (!tenant) {
        throw new ORPCError("NOT_FOUND", {
          message: "Tenant not found",
          data: { resource: "tenant", resourceId: input.tenantId },
        });
      }
      if (tenant.orgId !== activeOrgId) {
        throw new ORPCError("FORBIDDEN", {
          message: "You are not a member of this tenant's organization",
        });
      }
      return tenant;
    };

    return {
      ping: builder.ping.handler(async () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
      })),

      authHealth: builder.authHealth.use(requireAuth).handler(async () => ({
        status: "ok",
        emailConfigured: !!process.env.EMAIL_PROVIDER,
        smsConfigured: !!process.env.SMS_PROVIDER,
      })),

      listTenants: builder.listTenants
        .use(requireAuth)
        .use(requireOrganization)
        .handler(async ({ context }) =>
          services.tenants.listTenantsByOrgIds([context.organization.activeOrganizationId]),
        ),

      createTenant: builder.createTenant
        .use(requireAuth)
        .use(requireOrganization)
        .handler(async ({ input, context }) => {
          validateSubdomain(input.subdomain);
          validateAccountId(input.accountId);
          if (!input.accountId.startsWith(`${input.subdomain}.`)) {
            throw new ORPCError("BAD_REQUEST", {
              message: "accountId must start with subdomain",
              data: { subdomain: input.subdomain, accountId: input.accountId },
            });
          }
          return await services.tenants.createTenant({
            subdomain: input.subdomain,
            name: input.name,
            accountId: input.accountId,
            orgId: context.organization.activeOrganizationId,
            status: input.status,
          });
        }),

      updateTenant: builder.updateTenant
        .use(requireAuth)
        .use(requireOrgRole("owner"))
        .handler(async ({ input, context }) => {
          const tenant = await authorizedTenant(input, context);
          if (input.subdomain !== undefined) validateSubdomain(input.subdomain);
          if (input.accountId !== undefined) validateAccountId(input.accountId);
          return await services.tenants.updateTenant(tenant.id, {
            name: input.name,
            subdomain: input.subdomain,
            accountId: input.accountId,
            status: input.status,
          });
        }),

      deleteTenant: builder.deleteTenant
        .use(requireAuth)
        .use(requireOrgRole("owner"))
        .handler(async ({ input, context }) => {
          await authorizedTenant(input, context);
          const result = await services.tenants.softDeleteTenant(input.tenantId);
          if (!result) {
            throw new ORPCError("NOT_FOUND", {
              message: "Tenant not found",
              data: { resource: "tenant", resourceId: input.tenantId },
            });
          }
          return result;
        }),

      suspendTenant: builder.suspendTenant
        .use(requireAuth)
        .use(requireOrgRole("admin"))
        .handler(async ({ input, context }) => {
          await authorizedTenant(input, context);
          const result = await services.tenants.suspendTenant(input.tenantId);
          if (!result) {
            throw new ORPCError("NOT_FOUND", {
              message: "Tenant not found",
              data: { resource: "tenant", resourceId: input.tenantId },
            });
          }
          return result;
        }),

      reactivateTenant: builder.reactivateTenant
        .use(requireAuth)
        .use(requireOrgRole("admin"))
        .handler(async ({ input, context }) => {
          await authorizedTenant(input, context);
          const result = await services.tenants.reactivateTenant(input.tenantId);
          if (!result) {
            throw new ORPCError("NOT_FOUND", {
              message: "Tenant not found",
              data: { resource: "tenant", resourceId: input.tenantId },
            });
          }
          return result;
        }),

      resolveTenant: builder.resolveTenant.handler(async ({ input }) => {
        const tenant = await services.tenants.resolveTenantByAccountId(input.accountId);
        return tenant ?? null;
      }),

      resolveTenantByOrgId: builder.resolveTenantByOrgId.handler(async ({ input, errors }) => {
        const tenant = await services.tenants.resolveTenantByOrgId(input.orgId);
        if (!tenant) {
          throw errors.NOT_FOUND({
            message: "Tenant not found",
            data: { resource: "tenant", resourceId: input.orgId },
          });
        }
        return tenant;
      }),

      tenantPreflight: builder.tenantPreflight.use(requireAuth).handler(async ({ input }) => {
        const subdomainValid = SUBDOMAIN_SEGMENT_REGEX.test(input.subdomain);
        const accountId = `${input.subdomain}.${input.parentAccount}`;
        const accountFormat = ACCOUNT_ID_REGEX.test(accountId)
          ? ("valid" as const)
          : ("invalid" as const);

        const reserved = RESERVED_SUBDOMAINS.has(input.subdomain);
        const existingSubdomain = subdomainValid
          ? await services.tenants.resolveTenantBySubdomain(input.subdomain)
          : null;
        const existingAccount = subdomainValid
          ? await services.tenants.resolveTenantByAccountId(accountId)
          : null;
        const accountAvailable = accountFormat === "valid" && !existingAccount;

        return {
          subdomain: { available: !reserved && !existingSubdomain, reserved },
          accountId: { format: accountFormat, available: accountAvailable },
        };
      }),

      createRound: builder.createRound.use(requireAuth).handler(async ({ input, context }) => {
        const ownerAccountId = context.near?.primaryAccountId;
        if (!ownerAccountId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Link a NEAR account before requesting a feedback round",
            data: { hint: "Link a NEAR wallet in settings" },
          });
        }
        const round = await services.rounds.createRound({
          ownerAccountId,
          projectSlug: input.projectSlug,
          projectId: input.projectId ?? null,
          title: input.title,
          description: input.description,
          formats: input.formats,
          repoUrl: input.repoUrl,
        });
        const eventId = await services.activityEvents.emitRoundOpened(round);
        if (eventId) await services.rounds.setRoundActivityEventId(round.id, eventId);
        return round;
      }),

      listRounds: builder.listRounds.handler(async ({ input }) =>
        services.rounds.listRounds(input.status),
      ),

      deleteRound: builder.deleteRound
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Link a NEAR account before deleting a round",
            });
          }
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (round.ownerAccountId !== accountId) {
            throw new ORPCError("FORBIDDEN", { message: "Only the round owner can delete it" });
          }
          if (round.status !== "open") {
            throw new ORPCError("BAD_REQUEST", { message: "Closed rounds can't be deleted" });
          }
          const result = await services.rounds.deleteRound(round.id);
          if (result?.activityEventId) {
            await services.activityEvents.retract(result.activityEventId, "round deleted");
          }
          return round;
        }),

      getRound: builder.getRound.handler(async ({ input, errors }) => {
        const round = await services.rounds.getRoundDetail(input.id);
        if (!round) {
          throw errors.NOT_FOUND({
            message: "Round not found",
            data: { resource: "round", resourceId: input.id },
          });
        }
        return round;
      }),

      joinRound: builder.joinRound.use(requireAuth).handler(async ({ input, context, errors }) => {
        const accountId = context.near?.primaryAccountId;
        if (!accountId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Link a NEAR account before joining a round",
            data: { hint: "Link a NEAR wallet in settings" },
          });
        }
        const round = await services.rounds.resolveRoundById(input.id);
        if (!round) {
          throw errors.NOT_FOUND({
            message: "Round not found",
            data: { resource: "round", resourceId: input.id },
          });
        }
        if (round.status !== "open") {
          throw new ORPCError("BAD_REQUEST", { message: "This round is no longer open" });
        }
        if (round.ownerAccountId === accountId) {
          throw new ORPCError("BAD_REQUEST", { message: "You can't join your own round" });
        }
        await services.rounds.addParticipant(round.id, accountId);
        const detail = await services.rounds.getRoundDetail(round.id);
        if (!detail) {
          throw errors.NOT_FOUND({ message: "Round not found", data: { resourceId: round.id } });
        }
        return detail;
      }),

      leaveRound: builder.leaveRound
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Link a NEAR account before leaving a round",
            });
          }
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          await services.rounds.removeParticipant(round.id, accountId);
          const detail = await services.rounds.getRoundDetail(round.id);
          if (!detail) {
            throw errors.NOT_FOUND({ message: "Round not found", data: { resourceId: round.id } });
          }
          return detail;
        }),

      getMyParticipation: builder.getMyParticipation
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) return { joined: false };
          return { joined: await services.rounds.hasParticipant(input.id, accountId) };
        }),

      postFeedback: builder.postFeedback
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Link a NEAR account before posting feedback",
              data: { hint: "Link a NEAR wallet in settings" },
            });
          }
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (!round.formats.includes(input.format)) {
            throw new ORPCError("BAD_REQUEST", {
              message: `This round isn't collecting ${input.format} feedback`,
            });
          }
          const joined = await services.rounds.hasParticipant(round.id, accountId);
          if (!joined) {
            throw new ORPCError("FORBIDDEN", {
              message: "Join the round before posting feedback",
            });
          }
          const body = input.format === "written" ? (input.body?.trim() ?? null) : null;
          const url = input.format === "recorded" ? (input.url ?? null) : null;
          const feedback = await services.rounds.addFeedback({
            roundId: round.id,
            authorAccountId: accountId,
            format: input.format,
            body,
            url,
          });
          const eventId = await services.activityEvents.emitFeedbackPosted(feedback);
          if (eventId) await services.rounds.setFeedbackActivityEventId(feedback.id, eventId);
          const nostrEventId = await services.feedbackNostr.publish(
            {
              projectSlug: round.projectSlug,
              roundNumber: round.projectRoundNumber,
              format: input.format,
              content: (input.format === "written" ? body : url) ?? "",
              authorAccountId: accountId,
            },
            context,
          );
          if (nostrEventId)
            await services.rounds.setFeedbackNostrEventId(feedback.id, nostrEventId);
          return { ...feedback, nostrEventId: nostrEventId ?? feedback.nostrEventId };
        }),

      listFeedback: builder.listFeedback.handler(async ({ input, errors }) => {
        const round = await services.rounds.resolveRoundById(input.id);
        if (!round) {
          throw errors.NOT_FOUND({
            message: "Round not found",
            data: { resource: "round", resourceId: input.id },
          });
        }
        return await services.rounds.listFeedback(round.id);
      }),

      deleteFeedback: builder.deleteFeedback
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) {
            throw new ORPCError("UNAUTHORIZED", {
              message: "Link a NEAR account before removing feedback",
            });
          }
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (round.ownerAccountId !== accountId) {
            throw new ORPCError("FORBIDDEN", {
              message: "Only the round owner can remove feedback",
            });
          }
          const feedbackList = await services.rounds.listFeedback(round.id);
          const feedback = feedbackList.find((f) => f.id === input.feedbackId);
          if (!feedback) {
            throw errors.NOT_FOUND({
              message: "Feedback not found",
              data: { resource: "feedback", resourceId: input.feedbackId },
            });
          }
          const result = await services.rounds.deleteFeedback(input.feedbackId);
          if (result?.activityEventId) {
            await services.activityEvents.retract(result.activityEventId, "feedback invalidated");
          }
          if (feedback.nostrEventId) {
            // The nostr plugin's contract has no delete/retract method (Nostr has
            // no server-enforced deletion), so unlike the activity event above,
            // this comment stays live on relays after the feedback is removed here.
            console.warn(
              `[nostr] feedback ${feedback.id} deleted, but its comment ${feedback.nostrEventId} can't be retracted and remains on relays`,
            );
          }
          return feedback;
        }),

      getCreditCandidates: builder.getCreditCandidates
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (round.ownerAccountId !== context.near?.primaryAccountId) {
            throw new ORPCError("FORBIDDEN", { message: "Only the round owner can see this" });
          }
          return await services.rounds.getCreditCandidates(round.id);
        }),

      closeRound: builder.closeRound
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Link a NEAR account before closing a round",
              data: { hint: "Link a NEAR wallet in settings" },
            });
          }
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (round.ownerAccountId !== accountId) {
            throw new ORPCError("FORBIDDEN", { message: "Only the round owner can close it" });
          }
          if (round.status !== "open") {
            throw new ORPCError("BAD_REQUEST", { message: "This round is already closed" });
          }
          const detail = await services.rounds.closeRound(round.id, input.credits ?? []);
          await services.activityEvents.emitRoundClosed(detail);
          const credits = await services.rounds.listRoundCredits(round.id);
          for (const credit of credits) {
            if (!credit.contributedMeaningfully) continue;
            await services.activityEvents.emitCreditAwarded(credit);
          }
          return detail;
        }),

      listRoundCredits: builder.listRoundCredits.handler(async ({ input, errors }) => {
        const round = await services.rounds.resolveRoundById(input.id);
        if (!round) {
          throw errors.NOT_FOUND({
            message: "Round not found",
            data: { resource: "round", resourceId: input.id },
          });
        }
        return await services.rounds.listRoundCredits(round.id);
      }),

      getBuilderRounds: builder.getBuilderRounds.handler(async ({ input }) =>
        services.rounds.listBuilderRounds(input.accountId),
      ),

      getRoundEndorsements: builder.getRoundEndorsements.handler(async ({ input }) => {
        const eventIds = await services.rounds.listRoundActivityEventIds(input.roundIds);
        const counts = await services.activityEvents.endorsements(Object.values(eventIds));
        const result: Record<string, { eventId: string; totalCount: number }> = {};
        if (!counts) return result;
        for (const [roundId, eventId] of Object.entries(eventIds)) {
          const endorsement = counts[eventId];
          if (endorsement) result[roundId] = { eventId, totalCount: endorsement.totalCount };
        }
        return result;
      }),

      getBuilderActivity: builder.getBuilderActivity.handler(async ({ input }) => {
        const events = await services.activityEvents.listActorEvents({
          actor: input.accountId,
          limit: input.limit,
        });
        return (events ?? []).map((event) => ({
          id: event.id,
          source: event.source,
          sourceDisplayName: event.provenance.sourceDisplayName,
          type: event.type,
          timestamp: event.timestamp,
          payload:
            event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
              ? event.payload
              : {},
        }));
      }),

      searchProjects: builder.searchProjects.handler(async ({ input }) => {
        const results = await services.projectsLookup.search(input.query);
        return results ?? [];
      }),

      resolveProjectBySlug: builder.resolveProjectBySlug.handler(async ({ input }) => {
        return await services.projectsLookup.resolveBySlug(input.slug);
      }),

      getLeaderboard: builder.getLeaderboard.handler(async ({ input }) => {
        const result = await services.activityEvents.leaderboard({
          period: input.period,
          type: "feedback.posted",
          limit: input.limit,
        });
        return result
          ? {
              period: result.period,
              data: result.data.map((entry) => ({
                rank: entry.rank,
                actor: entry.actor,
                score: entry.score,
                eventCount: entry.eventCount,
              })),
            }
          : { period: input.period, data: [] };
      }),

      testError: builder.testError.handler(async ({ input }) => {
        switch (input.kind) {
          case "unauthorized":
            throw new ORPCError("UNAUTHORIZED", { message: "test unauthorized error" });
          case "forbidden":
            throw new ORPCError("FORBIDDEN", { message: "test forbidden error" });
          case "not_found":
            throw new ORPCError("NOT_FOUND", { message: "test not found error" });
          case "conflict":
            throw new ORPCError("CONFLICT", { message: "test conflict error" });
          case "bad_request":
            throw new ORPCError("BAD_REQUEST", { message: "test bad request error" });
          default:
            throw new Error("test internal server error");
        }
      }),
    };
  },
});
