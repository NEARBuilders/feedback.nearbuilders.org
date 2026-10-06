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
import { createGithubIssuesLookup } from "./services/github-issues";
import { createLegionAccess } from "./services/legion-access";
import { notificationText } from "./services/notification-text";
import { NotificationsLive, NotificationsTag } from "./services/notifications";
import {
  POINTS_PER_ACCEPTED_FEEDBACK,
  periodStart,
  pointsForAccepted,
  rankStandings,
} from "./services/points";
import type { ProjectRecord } from "./services/project-records";
import { ProjectRecordsLive, ProjectRecordsTag } from "./services/project-records";
import { createProjectsLookup } from "./services/projects";
import {
  canManageRound,
  isOrgAdminRole,
  needsTeamCheck,
  type RoundActor,
} from "./services/round-access";
import { RoundsLive, RoundsTag } from "./services/rounds";
import { createTeamAccess } from "./services/team-access";
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
    // the picker falls back to free-text entry when unreachable. See
    // services/projects.ts.
    PROJECTS_API_BASE_URL: z.string().default("https://nearbuilders.org/api"),
    // Optional GitHub PAT used to read issues filed on a round's repo for
    // GitHub-issue credit (#49). Public repos work unauthenticated too, just
    // rate-limited to 60/hr instead of 5000/hr. See services/github-issues.ts.
    GITHUB_API_TOKEN: z.string().default(""),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, plugins, tools) =>
    Effect.gen(function* () {
      const database = DatabaseLive(config.secrets.API_DATABASE_URL);
      const tenantsLayer = TenantsLive.pipe(Layer.provide(database));
      const roundsLayer = RoundsLive.pipe(Layer.provide(database));
      const projectRecordsLayer = ProjectRecordsLive.pipe(Layer.provide(database));
      const notificationsLayer = NotificationsLive.pipe(Layer.provide(database));

      const tenantsService = yield* tools.buildService(TenantsTag, tenantsLayer);
      const roundsService = yield* tools.buildService(RoundsTag, roundsLayer);
      const projectRecordsService = yield* tools.buildService(
        ProjectRecordsTag,
        projectRecordsLayer,
      );

      const notificationsService = yield* tools.buildService(NotificationsTag, notificationsLayer);

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

      const teamAccess = createTeamAccess(plugins.auth);

      const legionAccess = createLegionAccess(plugins.legion);

      const githubIssuesLookup = createGithubIssuesLookup({
        token: config.secrets.GITHUB_API_TOKEN,
      });

      console.log(
        `[API] Services Initialized (activity events ${activityEvents.enabled ? "enabled" : "disabled"}, feedback nostr comments ${feedbackNostr.enabled ? "enabled" : "disabled"}, projects lookup ${projectsLookup.enabled ? "enabled" : "disabled"}, github issues token ${config.secrets.GITHUB_API_TOKEN ? "configured" : "anonymous"})`,
      );

      return {
        tenants: tenantsService,
        rounds: roundsService,
        projectRecords: projectRecordsService,
        notifications: notificationsService,
        activityEvents,
        feedbackNostr,
        projectsLookup,
        teamAccess,
        legionAccess,
        githubIssuesLookup,
      };
    }),

  shutdown: () => Effect.log("[API] Shutdown"),

  createRouter: (services, builder) => {
    const { requireAuth, requireAdmin, requireOrganization, requireOrgRole } =
      createAuthMiddleware(builder);

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

    interface ActorContext {
      userId?: string | null;
      near?: { primaryAccountId?: string | null } | null;
      organization?: {
        activeOrganizationId?: string | null;
        member?: { role?: string | null } | null;
      } | null;
    }

    /**
     * Builds the caller's access profile for a project. A team lookup only happens when the
     * project is delegated to a team and the caller is neither an org owner nor admin.
     */
    const resolveActor = async (
      project: ProjectRecord | null,
      context: ActorContext,
    ): Promise<RoundActor> => {
      const actor: RoundActor = {
        activeOrganizationId: context.organization?.activeOrganizationId,
        accountId: context.near?.primaryAccountId,
        orgRole: context.organization?.member?.role,
      };
      if (project?.managingTeamId && context.userId && needsTeamCheck(project, actor)) {
        actor.inManagingTeam = await services.teamAccess.isMember(
          context as Record<string, unknown>,
          project.managingTeamId,
          context.userId,
        );
      }
      return actor;
    };

    /**
     * Rounds are managed by the org that owns their project (#70), or by the team the org
     * delegated the project to (#79). Throws FORBIDDEN with `message` otherwise.
     */
    const assertCanManageRound = async (
      round: { ownerAccountId: string; projectRecordId: string },
      context: ActorContext,
      message: string,
    ) => {
      const project = await services.projectRecords.resolveProjectById(round.projectRecordId);
      const allowed = canManageRound(round, project, await resolveActor(project, context));
      if (!allowed) throw new ORPCError("FORBIDDEN", { message });
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

      createRound: builder.createRound
        .use(requireAuth)
        .use(requireOrganization)
        .handler(async ({ input, context }) => {
          const ownerAccountId = context.near?.primaryAccountId;
          if (!ownerAccountId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Link a NEAR account before requesting a feedback round",
              data: { hint: "Link a NEAR wallet in settings" },
            });
          }
          const round = await services.rounds.createRound({
            ownerAccountId,
            ownerOrgId: context.organization.activeOrganizationId,
            projectSlug: input.projectSlug,
            projectName: input.projectName,
            projectId: input.projectId ?? null,
            title: input.title,
            description: input.description,
            readme: input.readme,
            formats: input.formats,
            repoUrl: input.repoUrl,
          });
          // A round on a not-yet-approved project waits as "pending" until an admin
          // decides the project (#69); round.opened fires then. On an already
          // approved project it opens immediately (#70), so announce it now.
          if (round.status === "open") {
            const eventId = await services.activityEvents.emitRoundOpened(round);
            if (eventId) await services.rounds.setRoundActivityEventId(round.id, eventId);
          }
          return round;
        }),

      updateRoundReadme: builder.updateRoundReadme
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          await assertCanManageRound(round, context, "Only the round owner can edit the readme");
          return await services.rounds.updateRoundReadme(round.id, input.readme);
        }),

      listRounds: builder.listRounds.handler(async ({ input, context }) => {
        const isAdmin = context.user?.role === "admin";
        if ((input.status === "pending" || input.status === "rejected") && !isAdmin) {
          throw new ORPCError("FORBIDDEN", {
            message: "Only admins can list pending or rejected rounds",
          });
        }
        const rounds = await services.rounds.listRounds(input.status);
        if (input.status) return rounds;
        // No filter: this is the public browse listing, so pending/rejected
        // rounds — visible only to their owning org or an admin — never appear in it.
        return rounds.filter((r) => r.status === "open" || r.status === "closed");
      }),

      listProjects: builder.listProjects
        .use(requireAdmin)
        .handler(async ({ input }) => services.projectRecords.listProjects(input.status)),

      listMyProjects: builder.listMyProjects
        .use(requireAuth)
        .use(requireOrganization)
        .handler(async ({ context }) =>
          services.projectRecords.listProjectsByOrg(context.organization.activeOrganizationId),
        ),

      approveProject: builder.approveProject
        .use(requireAdmin)
        .handler(async ({ input, errors }) => {
          const existing = await services.projectRecords.resolveProjectById(input.id);
          if (!existing) {
            throw errors.NOT_FOUND({
              message: "Project not found",
              data: { resource: "project", resourceId: input.id },
            });
          }
          const { decidedRoundIds } = await services.projectRecords.approveProject(existing.id);
          for (const roundId of decidedRoundIds) {
            const round = await services.rounds.resolveRoundById(roundId);
            if (!round) continue;
            const eventId = await services.activityEvents.emitRoundOpened(round);
            if (eventId) await services.rounds.setRoundActivityEventId(round.id, eventId);
          }
          const project = await services.projectRecords.getProjectWithRounds(existing.id);
          if (!project) {
            throw errors.NOT_FOUND({
              message: "Project not found",
              data: { resourceId: input.id },
            });
          }
          return project;
        }),

      rejectProject: builder.rejectProject.use(requireAdmin).handler(async ({ input, errors }) => {
        const existing = await services.projectRecords.resolveProjectById(input.id);
        if (!existing) {
          throw errors.NOT_FOUND({
            message: "Project not found",
            data: { resource: "project", resourceId: input.id },
          });
        }
        await services.projectRecords.rejectProject(existing.id, input.reason);
        const project = await services.projectRecords.getProjectWithRounds(existing.id);
        if (!project) {
          throw errors.NOT_FOUND({ message: "Project not found", data: { resourceId: input.id } });
        }
        return project;
      }),

      setProjectManagingTeam: builder.setProjectManagingTeam
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const project = await services.projectRecords.resolveProjectById(input.id);
          if (!project) {
            throw errors.NOT_FOUND({
              message: "Project not found",
              data: { resource: "project", resourceId: input.id },
            });
          }
          const isSiteAdmin = context.user?.role === "admin";
          const isOrgAdmin =
            !!project.ownerOrgId &&
            context.organization?.activeOrganizationId === project.ownerOrgId &&
            isOrgAdminRole(context.organization?.member?.role);
          if (!isSiteAdmin && !isOrgAdmin) {
            throw new ORPCError("FORBIDDEN", {
              message: "Only the organization's owners and admins can delegate a project to a team",
            });
          }
          if (input.teamId !== null) {
            if (!project.ownerOrgId) {
              throw new ORPCError("BAD_REQUEST", {
                message: "This project has no owning organization to take a team from",
              });
            }
            const teamIds = await services.teamAccess.listOrgTeamIds(
              context as Record<string, unknown>,
              project.ownerOrgId,
            );
            if (teamIds === null) {
              throw new ORPCError("BAD_REQUEST", {
                message: "Couldn't verify the organization's teams right now",
              });
            }
            if (!teamIds.includes(input.teamId)) {
              throw new ORPCError("BAD_REQUEST", {
                message: "That team doesn't belong to this project's organization",
              });
            }
          }
          await services.projectRecords.setManagingTeam(project.id, input.teamId);
          const updated = await services.projectRecords.getProjectWithRounds(project.id);
          if (!updated) {
            throw errors.NOT_FOUND({
              message: "Project not found",
              data: { resourceId: input.id },
            });
          }
          return updated;
        }),

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
          await assertCanManageRound(round, context, "Only the round owner can delete it");
          if (round.status === "closed") {
            throw new ORPCError("BAD_REQUEST", { message: "Closed rounds can't be deleted" });
          }
          const result = await services.rounds.deleteRound(round.id);
          if (result?.activityEventId) {
            await services.activityEvents.retract(result.activityEventId, "round deleted");
          }
          return round;
        }),

      getRound: builder.getRound.handler(async ({ input, context, errors }) => {
        const round = await services.rounds.getRoundDetail(input.id);
        if (!round) {
          throw errors.NOT_FOUND({
            message: "Round not found",
            data: { resource: "round", resourceId: input.id },
          });
        }
        const project = await services.projectRecords.resolveProjectById(round.projectRecordId);
        const canManage = canManageRound(round, project, await resolveActor(project, context));
        if (round.status === "pending" || round.status === "rejected") {
          const isAdmin = context.user?.role === "admin";
          if (!canManage && !isAdmin) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
        }
        return { ...round, canManage };
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
        const project = await services.projectRecords.resolveProjectById(round.projectRecordId);
        if (
          project?.ownerOrgId &&
          context.organization?.activeOrganizationId === project.ownerOrgId
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Your organization runs this round, so you can't join it as a tester",
          });
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

      getMyLegionAccess: builder.getMyLegionAccess.handler(async ({ context }) => {
        return await services.legionAccess.getMyAccess(
          context,
          context.near?.primaryAccountId ?? null,
        );
      }),

      listMyJoinedRounds: builder.listMyJoinedRounds
        .use(requireAuth)
        .handler(async ({ context }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) return [];
          return services.rounds.listMyJoinedRounds(accountId);
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
          await assertCanManageRound(round, context, "Only the round owner can remove feedback");
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

      setFeedbackStatus: builder.setFeedbackStatus
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (context.user?.role !== "admin") {
            await assertCanManageRound(
              round,
              context,
              "Only the round owner can resolve or dismiss feedback",
            );
          }
          return await services.rounds.setFeedbackStatus(round.id, input.feedbackIds, input.status);
        }),

      listParticipants: builder.listParticipants
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          const accountId = context.near?.primaryAccountId;
          const isParticipant = accountId
            ? await services.rounds.hasParticipant(round.id, accountId)
            : false;
          if (!isParticipant && context.user?.role !== "admin") {
            await assertCanManageRound(
              round,
              context,
              "Only the round owner and its participants can see who joined",
            );
          }
          return await services.rounds.listParticipants(round.id);
        }),

      broadcastToRound: builder.broadcastToRound
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (context.user?.role !== "admin") {
            await assertCanManageRound(round, context, "Only the round owner can send a broadcast");
          }
          if (round.status !== "open") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Broadcasts can only be sent while the round is open",
            });
          }
          const text = notificationText(input.kind, round.title, input.message);
          const recipients = await services.notifications.notifyParticipants({
            roundId: round.id,
            kind: input.kind,
            ...text,
          });
          return { recipients };
        }),

      listNotifications: builder.listNotifications
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) return { items: [], unreadCount: 0 };
          return await services.notifications.listForAccount(accountId, input.limit);
        }),

      markNotificationRead: builder.markNotificationRead
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) {
            throw new ORPCError("UNAUTHORIZED", {
              message: "Link a NEAR account to manage notifications",
            });
          }
          const notification = await services.notifications.markRead(accountId, input.id);
          if (!notification) {
            throw errors.NOT_FOUND({
              message: "Notification not found",
              data: { resource: "notification", resourceId: input.id },
            });
          }
          return notification;
        }),

      markAllNotificationsRead: builder.markAllNotificationsRead
        .use(requireAuth)
        .handler(async ({ context }) => {
          const accountId = context.near?.primaryAccountId;
          if (!accountId) return { updated: 0 };
          return { updated: await services.notifications.markAllRead(accountId) };
        }),

      getRoundGithubIssues: builder.getRoundGithubIssues.handler(async ({ input, errors }) => {
        const round = await services.rounds.resolveRoundById(input.id);
        if (!round) {
          throw errors.NOT_FOUND({
            message: "Round not found",
            data: { resource: "round", resourceId: input.id },
          });
        }
        if (!round.formats.includes("issues") || !round.repoUrl) {
          throw new ORPCError("BAD_REQUEST", {
            message: "This round isn't collecting GitHub issues",
          });
        }
        const contributors = await services.githubIssuesLookup.forRound({
          repoUrl: round.repoUrl,
          windowStart: round.createdAt,
          windowEnd: round.closedAt,
        });
        return {
          repoUrl: round.repoUrl,
          windowStart: round.createdAt,
          windowEnd: round.closedAt,
          contributors: contributors ?? [],
        };
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
          await assertCanManageRound(round, context, "Only the round owner can see this");
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
          await assertCanManageRound(round, context, "Only the round owner can close it");
          if (round.status !== "open") {
            throw new ORPCError("BAD_REQUEST", { message: "This round is already closed" });
          }
          const detail = await services.rounds.closeRound(round.id, input.credits ?? []);
          try {
            const text = notificationText("round_closed", round.title);
            await services.notifications.notifyParticipants({
              roundId: round.id,
              kind: "round_closed",
              ...text,
            });
          } catch (error) {
            console.warn(
              `[notifications] round ${round.id} closed, but notifying participants failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
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
        return { available: results !== null, results: results ?? [] };
      }),

      getProjectSearchStatus: builder.getProjectSearchStatus.handler(async () => ({
        enabled: services.projectsLookup.enabled,
      })),

      resolveProjectBySlug: builder.resolveProjectBySlug.handler(async ({ input }) => {
        return await services.projectsLookup.resolveBySlug(input.slug);
      }),

      getPointsLeaderboard: builder.getPointsLeaderboard.handler(async ({ input }) => {
        const counts = await services.rounds.listAcceptedCounts(periodStart(input.period));
        const standings = rankStandings(counts).slice(0, input.limit ?? 50);
        return {
          period: input.period,
          pointsPerAcceptedFeedback: POINTS_PER_ACCEPTED_FEEDBACK,
          data: standings.map((entry) => ({
            rank: entry.rank,
            actor: entry.accountId,
            points: entry.points,
            acceptedCount: entry.acceptedCount,
          })),
        };
      }),

      getBuilderPoints: builder.getBuilderPoints.handler(async ({ input }) => {
        const totals = await services.rounds.getFeedbackTotals(input.accountId);
        const standings = rankStandings(await services.rounds.listAcceptedCounts(null));
        const rank = standings.find((entry) => entry.accountId === input.accountId)?.rank ?? null;
        return {
          accountId: input.accountId,
          points: pointsForAccepted(totals.acceptedCount),
          acceptedCount: totals.acceptedCount,
          submittedCount: totals.submittedCount,
          rank,
        };
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
              configured: true,
              available: true,
              data: result.data.map((entry) => ({
                rank: entry.rank,
                actor: entry.actor,
                score: entry.score,
                eventCount: entry.eventCount,
              })),
            }
          : {
              period: input.period,
              configured: services.activityEvents.readable,
              available: false,
              data: [],
            };
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
