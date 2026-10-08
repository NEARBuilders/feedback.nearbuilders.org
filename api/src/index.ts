import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract, type ProjectIdentity } from "./contract";
import { DatabaseLive, DatabaseTag } from "./db/layer";
import type { activityOutbox as activityOutboxTable } from "./db/schema";
import { createAuthMiddleware } from "./lib/auth";
import { ContextSchema } from "./lib/context";
import type { PluginsClient } from "./lib/plugins-types.gen";
import { createActivityEmitter } from "./services/activity-events";
import { createActivityOutboxWorker } from "./services/activity-outbox";
import { createFeedbackNostrEmitter } from "./services/feedback-nostr";
import { createGithubIssuesLookup } from "./services/github-issues";
import { createLegionAccess } from "./services/legion-access";
import { actingAccountId, linkedAccountIds } from "./services/linked-accounts";
import { type FeedbackStatusKind, notificationText } from "./services/notification-text";
import { NotificationsLive, NotificationsTag } from "./services/notifications";
import { type OrganizationPrincipal, orgKeyOrganizationId } from "./services/org-key";
import type { ProjectRecord } from "./services/project-records";
import { ProjectRecordsLive, ProjectRecordsTag } from "./services/project-records";
import { createProjectsLookup } from "./services/projects";
import type { NearBuildersProject } from "./services/projects-client";
import {
  canManageProject,
  canManageRound,
  canReadAllFeedback,
  filterVisibleFeedback,
  isOrgAdminRole,
  needsTeamCheck,
  type RoundActor,
} from "./services/round-access";
import { type RoundDetailRecord, RoundsLive, RoundsTag } from "./services/rounds";
import { createTeamAccess } from "./services/team-access";
import { createTelegramTipLookup } from "./services/telegram-tip";

const MAX_FEEDBACK_PER_TESTER = 500;

/**
 * How deep to scan the activity board when resolving one builder's standing.
 * The gateway has no per-actor lookup, so an unranked builder is one who does
 * not appear this far down.
 */
// The gateway hard-caps its leaderboard at 100 entries per request with no
// cursor, so a builder ranked below the top 100 reads as unscored. Widening
// this needs activity.nearbuilders.org to page the board.
const BUILDER_STANDING_SCAN_LIMIT = 100;

const MAX_NOTES_PER_FEEDBACK = 20;

const isPublic = (round: { status: string }) =>
  round.status === "open" || round.status === "closed";

const toIsoDateTime = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value);

const toActivityOutboxRow = (row: typeof activityOutboxTable.$inferSelect) => ({
  ...row,
  nextAttemptAt: toIsoDateTime(row.nextAttemptAt),
  createdAt: toIsoDateTime(row.createdAt),
  sentAt: row.sentAt ? toIsoDateTime(row.sentAt) : null,
});

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
    // Tip-bot message a round manager sends to tip a tester (#105). `{handle}` and
    // `{account}` are replaced. Config-driven because the bot's command format may change.
    TIP_MESSAGE_TEMPLATE: z.string().default("/tip @{handle}"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, plugins, tools) =>
    Effect.gen(function* () {
      const database = DatabaseLive(config.secrets.API_DATABASE_URL);
      const db = yield* tools.buildService(DatabaseTag, database);
      const roundsLayer = RoundsLive.pipe(Layer.provide(database));
      const projectRecordsLayer = ProjectRecordsLive.pipe(Layer.provide(database));
      const notificationsLayer = NotificationsLive.pipe(Layer.provide(database));

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

      const telegramTip = createTelegramTipLookup({
        baseUrl: config.secrets.PROJECTS_API_BASE_URL,
        messageTemplate: config.secrets.TIP_MESSAGE_TEMPLATE,
      });

      const githubIssuesLookup = createGithubIssuesLookup({
        token: config.secrets.GITHUB_API_TOKEN,
      });

      // activity is the only source of reputation, so its reputation-bearing
      // events are queued durably and drained here rather than fired and forgotten.
      const activityOutbox = createActivityOutboxWorker({ db, emitter: activityEvents });
      activityOutbox.start();

      console.log(
        `[API] Services Initialized (activity events ${activityEvents.enabled ? "enabled" : "disabled"}, feedback nostr comments ${feedbackNostr.enabled ? "enabled" : "disabled"}, projects lookup ${projectsLookup.enabled ? "enabled" : "disabled"}, github issues token ${config.secrets.GITHUB_API_TOKEN ? "configured" : "anonymous"})`,
      );

      return {
        rounds: roundsService,
        projectRecords: projectRecordsService,
        notifications: notificationsService,
        activityEvents,
        activityOutbox,
        feedbackNostr,
        projectsLookup,
        teamAccess,
        legionAccess,
        telegramTip,
        githubIssuesLookup,
      };
    }),

  shutdown: (services) =>
    Effect.sync(() => {
      services.activityOutbox.stop();
      console.log("[API] Shutdown");
    }),

  createRouter: (services, builder) => {
    const { requireAuth, requireAuthOrApiKey, requireAdmin, requireOrganization } =
      createAuthMiddleware(builder);

    /**
     * Project identity lives in the nearbuilders.org registry, not here. These
     * helpers attach it at read time so there is no mirrored copy to drift.
     */
    const toIdentity = (project: NearBuildersProject | undefined | null): ProjectIdentity =>
      project
        ? {
            title: project.title,
            description: project.description,
            domain: project.domain,
            repository: project.repository,
            logoUrl: project.logoUrl,
            kind: project.kind,
          }
        : null;

    const withIdentity = async <T extends { slug: string }>(project: T) => ({
      ...project,
      identity: toIdentity(await services.projectsLookup.resolveBySlug(project.slug)),
    });

    /** One batch lookup for a list, rather than a request per project. */
    const withIdentities = async <T extends { slug: string }>(projects: T[]) => {
      const registry = await services.projectsLookup.resolveMany(
        projects.map((project) => project.slug),
      );
      return projects.map((project) => ({
        ...project,
        identity: toIdentity(registry.get(project.slug)),
      }));
    };

    const withRoundIdentity = async <T extends { projectSlug: string }>(round: T) => ({
      ...round,
      identity: toIdentity(await services.projectsLookup.resolveBySlug(round.projectSlug)),
    });

    /** Same batch lookup, for rounds, which carry their project's slug. */
    const withRoundIdentities = async <T extends { projectSlug: string }>(rounds: T[]) => {
      const registry = await services.projectsLookup.resolveMany(
        rounds.map((round) => round.projectSlug),
      );
      return rounds.map((round) => ({
        ...round,
        identity: toIdentity(registry.get(round.projectSlug)),
      }));
    };

    interface ActorContext {
      userId?: string | null;
      near?: {
        primaryAccountId?: string | null;
        linkedAccounts?: Array<{ accountId?: string | null }> | null;
      } | null;
      organization?: {
        activeOrganizationId?: string | null;
        member?: { role?: string | null } | null;
      } | null;
      principal?: OrganizationPrincipal | null;
      apiKey?: unknown;
    }

    /**
     * Builds the caller's access profile for a project. A team lookup only happens when the
     * project is delegated to a team and the caller is neither an org owner nor admin.
     */
    const resolveActor = async (
      project: ProjectRecord | null,
      context: ActorContext,
    ): Promise<RoundActor> => {
      // An organization API key acts as its organization's admin (#111): it reads everything
      // the org owns, bypassing team delegation. Every write procedure refuses it first via
      // assertNotOrgKey.
      const keyOrganizationId = orgKeyOrganizationId(context);
      if (keyOrganizationId) {
        return { activeOrganizationId: keyOrganizationId, orgRole: "owner", accountIds: [] };
      }
      const actor: RoundActor = {
        activeOrganizationId: context.organization?.activeOrganizationId,
        accountId: context.near?.primaryAccountId,
        accountIds: linkedAccountIds(context),
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
     * Organization API keys are read-only (#111): write procedures call this first so an org
     * key gets a clear refusal, while read procedures resolve it through resolveActor.
     */
    const assertNotOrgKey = (context: ViewerContext) => {
      if (orgKeyOrganizationId(context)) {
        throw new ORPCError("FORBIDDEN", { message: "Organization API keys are read-only" });
      }
    };

    /**
     * Rounds are managed by the org that owns their project (#70), or by the team the org
     * delegated the project to (#79). Throws FORBIDDEN with `message` otherwise.
     */
    const assertCanManageRound = async (
      round: { ownerAccountId: string; projectRecordId: string },
      context: ViewerContext,
      message: string,
    ) => {
      if (isSiteAdmin(context)) return;
      const project = await services.projectRecords.resolveProjectById(round.projectRecordId);
      const allowed = canManageRound(round, project, await resolveActor(project, context));
      if (!allowed) throw new ORPCError("FORBIDDEN", { message });
    };

    /**
     * Legion-gated rounds (#103): joining and posting need a Legion SBT on the caller's linked
     * NEAR account. Fails closed, so a failed holder lookup counts as "not a holder".
     */
    const assertLegionAccess = async (
      round: { legionOnly: boolean },
      accountId: string,
      context: ActorContext,
      action: "join" | "post in",
    ) => {
      if (!round.legionOnly) return;
      const access = await services.legionAccess.getMyAccess(
        context as Record<string, unknown>,
        accountId,
      );
      if (!access.hasAccess) {
        throw new ORPCError("FORBIDDEN", {
          message: `You need a Legion SBT to ${action} this round`,
          data: { legionOnly: true, mintUrl: access.mintUrl },
        });
      }
    };

    type ViewerContext = ActorContext & {
      user?: { id?: string | null; role?: string | null } | null;
    };

    const isSiteAdmin = (context: ViewerContext) => context.user?.role === "admin";

    const managesRound = (round: { canManage: boolean }, context: ViewerContext) =>
      round.canManage || isSiteAdmin(context);

    const nearAccountForNotes = (context: ViewerContext) => {
      const accountId = context.near?.primaryAccountId;
      if (!accountId) {
        throw new ORPCError("BAD_REQUEST", { message: "Link a NEAR account to add a note" });
      }
      return accountId;
    };

    const roundNotFound = (resourceId: string) =>
      new ORPCError("NOT_FOUND", {
        message: "Round not found",
        data: { resource: "round", resourceId },
      });

    const viewRoundDetail = async (
      round: RoundDetailRecord | null,
      context: ViewerContext,
      resourceId: string,
    ) => {
      if (!round) throw roundNotFound(resourceId);
      const project = await services.projectRecords.resolveProjectById(round.projectRecordId);
      const canManage = canManageRound(round, project, await resolveActor(project, context));
      const hidden = round.status === "pending" || round.status === "rejected";
      if (hidden && !managesRound({ canManage }, context)) throw roundNotFound(resourceId);
      return {
        ...round,
        canManage,
        identity: toIdentity(await services.projectsLookup.resolveBySlug(round.projectSlug)),
      };
    };

    const requireRound = async (id: string) => {
      const round = await services.rounds.resolveRoundById(id);
      if (!round) throw roundNotFound(id);
      return round;
    };

    const visibleRound = async (id: string, context: ViewerContext) =>
      viewRoundDetail(await services.rounds.getRoundDetail(id), context, id);

    const notifyAuthors = async (
      round: { id: string; title: string },
      feedback: Array<{ id: string; authorAccountId: string }>,
      kind: FeedbackStatusKind,
      note?: string,
    ) => {
      const byAuthor = new Map<string, string[]>();
      for (const item of feedback) {
        byAuthor.set(item.authorAccountId, [
          ...(byAuthor.get(item.authorAccountId) ?? []),
          item.id,
        ]);
      }
      try {
        await services.notifications.notifyAccounts({
          roundId: round.id,
          kind,
          ...notificationText(kind, round.title, note),
          recipients: [...byAuthor].map(([accountId, ids]) => ({
            accountId,
            feedbackId: ids.length === 1 ? (ids[0] ?? null) : null,
          })),
        });
      } catch (error) {
        console.warn(`[notifications] ${kind} for round ${round.id} failed`, error);
      }
    };

    const projectNotFound = (resourceId: string) =>
      new ORPCError("NOT_FOUND", {
        message: "Project not found",
        data: { resource: "project", resourceId },
      });

    const feedbackNotFound = (resourceId: string) =>
      new ORPCError("NOT_FOUND", {
        message: "Feedback not found",
        data: { resource: "feedback", resourceId },
      });

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
            isPrivate: input.isPrivate,
            legionOnly: input.legionOnly,
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

      updateRound: builder.updateRound
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context }) => {
          assertNotOrgKey(context);
          const round = await requireRound(input.id);
          await assertCanManageRound(
            round,
            context,
            "Only the round owner can change round settings",
          );
          if (input.formats?.includes("issues") && !round.repoUrl) {
            throw new ORPCError("BAD_REQUEST", {
              message: "A repo URL is required when the issues format is selected",
            });
          }
          return await services.rounds.updateRound(round.id, {
            readme: input.readme,
            formats: input.formats,
          });
        }),

      updateRoundSettings: builder.updateRoundSettings
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context, errors }) => {
          assertNotOrgKey(context);
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          await assertCanManageRound(
            round,
            context,
            "Only the round owner can change its privacy or Legion gate",
          );
          return await services.rounds.updateRoundSettings(round.id, {
            isPrivate: input.isPrivate,
            legionOnly: input.legionOnly,
          });
        }),

      listRounds: builder.listRounds.handler(async ({ input, context }) => {
        const isAdmin = context.user?.role === "admin";
        const keyOrganizationId = orgKeyOrganizationId(context);
        if (
          (input.status === "pending" || input.status === "rejected") &&
          !isAdmin &&
          !keyOrganizationId
        ) {
          throw new ORPCError("FORBIDDEN", {
            message: "Only admins can list pending or rejected rounds",
          });
        }
        const rounds = await services.rounds.listRounds(input.status);
        // Without a status filter this is the public browse listing, so pending/rejected
        // rounds — visible only to their owning org or an admin — never appear in it.
        const visible = input.status ? rounds : rounds.filter(isPublic);
        if (keyOrganizationId && !isAdmin) {
          // An org key lists only its own organization's rounds, whatever their status (#111).
          const projects = await services.projectRecords.listProjectsByOrg(keyOrganizationId);
          const ownedIds = new Set(projects.map((project) => project.id));
          return withRoundIdentities(
            visible.filter((round) => ownedIds.has(round.projectRecordId)),
          );
        }
        return withRoundIdentities(visible);
      }),

      listProjects: builder.listProjects
        .use(requireAdmin)
        .handler(async ({ input }) =>
          withIdentities(await services.projectRecords.listProjects(input.status)),
        ),

      listMyProjects: builder.listMyProjects
        .use(requireAuth)
        .use(requireOrganization)
        .handler(async ({ context }) =>
          withIdentities(
            await services.projectRecords.listProjectsByOrg(
              context.organization.activeOrganizationId,
            ),
          ),
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
          return withIdentity(project);
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
        return withIdentity(project);
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
          return withIdentity(updated);
        }),

      deleteRound: builder.deleteRound
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context, errors }) => {
          assertNotOrgKey(context);
          if (linkedAccountIds(context).length === 0) {
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

      getRound: builder.getRound.handler(async ({ input, context }) =>
        viewRoundDetail(await services.rounds.getRoundDetail(input.id), context, input.id),
      ),

      getRoundBySlug: builder.getRoundBySlug.handler(async ({ input, context }) =>
        viewRoundDetail(
          await services.rounds.getRoundDetailBySlug(input.slug, input.number),
          context,
          `${input.slug}/${input.number}`,
        ),
      ),

      joinRound: builder.joinRound.use(requireAuth).handler(async ({ input, context, errors }) => {
        const myAccounts = linkedAccountIds(context);
        if (myAccounts.length === 0) {
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
        if (myAccounts.includes(round.ownerAccountId)) {
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
        // One participation per user, whichever linked wallet is primary now: if one of their
        // accounts already joined, that stays the participation instead of adding a second.
        const alreadyJoinedAs = await services.rounds.findParticipantAccount(round.id, myAccounts);
        const accountId = actingAccountId(myAccounts, alreadyJoinedAs) as string;
        await assertLegionAccess(round, accountId, context, "join");
        await services.rounds.addParticipant(round.id, accountId);
        const detail = await services.rounds.getRoundDetail(round.id);
        if (!detail) {
          throw errors.NOT_FOUND({ message: "Round not found", data: { resourceId: round.id } });
        }
        return withRoundIdentity(detail);
      }),

      leaveRound: builder.leaveRound
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const myAccounts = linkedAccountIds(context);
          if (myAccounts.length === 0) {
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
          const joinedAs = await services.rounds.findParticipantAccount(round.id, myAccounts);
          if (joinedAs) await services.rounds.removeParticipant(round.id, joinedAs);
          const detail = await services.rounds.getRoundDetail(round.id);
          if (!detail) {
            throw errors.NOT_FOUND({ message: "Round not found", data: { resourceId: round.id } });
          }
          return withRoundIdentity(detail);
        }),

      getMyParticipation: builder.getMyParticipation
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const joinedAs = await services.rounds.findParticipantAccount(
            input.id,
            linkedAccountIds(context),
          );
          return { joined: joinedAs !== null };
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
          return services.rounds.listMyJoinedRounds(linkedAccountIds(context));
        }),

      getOwnerSummary: builder.getOwnerSummary
        .use(requireAuth)
        .use(requireOrganization)
        .handler(async ({ context }) =>
          services.rounds.getOwnerSummary(context.organization.activeOrganizationId),
        ),

      postFeedback: builder.postFeedback
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const myAccounts = linkedAccountIds(context);
          if (myAccounts.length === 0) {
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
          // Post as the account that joined, which may no longer be the primary one.
          const accountId = await services.rounds.findParticipantAccount(round.id, myAccounts);
          if (!accountId) {
            throw new ORPCError("FORBIDDEN", {
              message: "Join the round before posting feedback",
            });
          }
          await assertLegionAccess(round, accountId, context, "post in");
          const body = input.format === "written" ? (input.body?.trim() ?? null) : null;
          const url = input.format === "recorded" ? (input.url ?? null) : null;
          const feedback = await services.rounds.addFeedback({
            roundId: round.id,
            authorAccountId: accountId,
            format: input.format,
            body,
            url,
          });
          // The activity event never carries the feedback body, so it's safe for private
          // rounds too (#101).
          const eventId = await services.activityEvents.emitFeedbackPosted({
            ...feedback,
            roundTitle: round.title,
          });
          if (eventId) await services.rounds.setFeedbackActivityEventId(feedback.id, eventId);
          // A Nostr comment can't be retracted, so a private round's feedback never goes there.
          const nostrEventId = round.isPrivate
            ? null
            : await services.feedbackNostr.publish(
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

      listFeedback: builder.listFeedback.handler(async ({ input, context }) => {
        const round = await visibleRound(input.id, context);
        const page = await services.rounds.listFeedback(round.id, input);
        if (!round.isPrivate) return page;
        // Private round (#101): everything for the managing org/team and admins, otherwise
        // only the caller's own submissions. This one handler backs the HTTP route, the
        // data table's export and the MCP `listFeedback` tool. The cursor stays derived from
        // the unfiltered page, so filtering never blocks pagination.
        const project = await services.projectRecords.resolveProjectById(round.projectRecordId);
        const canReadAll = canReadAllFeedback(
          round,
          project,
          await resolveActor(project, context),
          isSiteAdmin(context),
        );
        return {
          items: filterVisibleFeedback(page.items, canReadAll, linkedAccountIds(context)),
          nextCursor: page.nextCursor,
        };
      }),

      listMyFeedback: builder.listMyFeedback
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const round = await visibleRound(input.id, context);
          const accountIds = linkedAccountIds(context);
          if (accountIds.length === 0) return [];
          const { items } = await services.rounds.listFeedback(round.id, {
            authors: accountIds,
            limit: MAX_FEEDBACK_PER_TESTER,
          });
          const notes = await services.rounds.listFeedbackNotes(items.map((item) => item.id));
          return items.map((feedback) => ({
            ...feedback,
            notes: notes.filter((note) => note.feedbackId === feedback.id),
          }));
        }),

      getFeedback: builder.getFeedback.handler(async ({ input, context }) => {
        const round = await visibleRound(input.id, context);
        const feedback = await services.rounds.getFeedback(round.id, input.feedbackId);
        if (!feedback) throw feedbackNotFound(input.feedbackId);
        const canSeeNotes =
          managesRound(round, context) ||
          linkedAccountIds(context).includes(feedback.authorAccountId);
        const notes = canSeeNotes ? await services.rounds.listFeedbackNotes([feedback.id]) : [];
        return { ...feedback, notes };
      }),

      addFeedbackNote: builder.addFeedbackNote
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const accountId = nearAccountForNotes(context);
          const round = await visibleRound(input.id, context);
          const feedback = await services.rounds.getFeedback(round.id, input.feedbackId);
          if (!feedback) throw feedbackNotFound(input.feedbackId);
          const isManager = managesRound(round, context);
          const isAuthor = linkedAccountIds(context).includes(feedback.authorAccountId);
          if (!isManager && !isAuthor) {
            throw new ORPCError("FORBIDDEN", {
              message: "Only the author or the round owner can add a note",
            });
          }
          const notes = await services.rounds.listFeedbackNotes([feedback.id]);
          if (notes.length >= MAX_NOTES_PER_FEEDBACK) {
            throw new ORPCError("BAD_REQUEST", { message: "This thread is full" });
          }
          if (!isManager && !notes.some((note) => note.role === "owner")) {
            throw new ORPCError("BAD_REQUEST", {
              message: "You can reply once the round owner leaves a note",
            });
          }
          return await services.rounds.addFeedbackNote({
            feedbackId: feedback.id,
            authorAccountId: isManager ? accountId : feedback.authorAccountId,
            role: isManager ? "owner" : "tester",
            body: input.body,
          });
        }),

      deleteFeedback: builder.deleteFeedback
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context, errors }) => {
          assertNotOrgKey(context);
          if (linkedAccountIds(context).length === 0) {
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
          const feedback = await services.rounds.getFeedback(round.id, input.feedbackId);
          if (!feedback) throw feedbackNotFound(input.feedbackId);
          if (!linkedAccountIds(context).includes(feedback.authorAccountId)) {
            await assertCanManageRound(
              round,
              context,
              "Only the author or the round owner can remove feedback",
            );
          } else if (round.status !== "open") {
            throw new ORPCError("BAD_REQUEST", {
              message: "This round is closed, so its feedback can no longer be deleted",
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
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context }) => {
          assertNotOrgKey(context);
          const round = await requireRound(input.id);
          await assertCanManageRound(
            round,
            context,
            "Only the round owner can resolve or dismiss feedback",
          );
          const note = input.note
            ? { authorAccountId: nearAccountForNotes(context), body: input.note }
            : undefined;
          const changed = await services.rounds.setFeedbackStatus(
            round.id,
            input.feedbackIds,
            input.status,
            note,
          );
          if (input.status !== "unresolved") {
            await notifyAuthors(round, changed, `feedback_${input.status}`, input.note);
          }
          return changed;
        }),

      setFeedbackStarred: builder.setFeedbackStarred
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context, errors }) => {
          assertNotOrgKey(context);
          // requireAuthOrApiKey leaves the context untyped for direct user access, so read
          // the viewer fields through the shared shape other handlers use.
          const viewer = context as ViewerContext;
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          if (viewer.user?.role !== "admin") {
            await assertCanManageRound(round, context, "Only the round owner can star feedback");
          }
          const starredBy = viewer.near?.primaryAccountId ?? viewer.user?.id ?? "admin";
          return await services.rounds.setFeedbackStarred(
            round.id,
            input.feedbackIds,
            input.starred,
            starredBy,
          );
        }),

      listParticipants: builder.listParticipants
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context, errors }) => {
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          const isParticipant =
            (await services.rounds.findParticipantAccount(round.id, linkedAccountIds(context))) !==
            null;
          if (!isParticipant) {
            await assertCanManageRound(
              round,
              context,
              "Only the round owner and its participants can see who joined",
            );
          }
          return await services.rounds.listParticipants(round.id);
        }),

      broadcastToRound: builder.broadcastToRound
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context, errors }) => {
          assertNotOrgKey(context);
          const round = await services.rounds.resolveRoundById(input.id);
          if (!round) {
            throw errors.NOT_FOUND({
              message: "Round not found",
              data: { resource: "round", resourceId: input.id },
            });
          }
          await assertCanManageRound(round, context, "Only the round owner can send a broadcast");
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
          const accountIds = linkedAccountIds(context);
          if (accountIds.length === 0) return { items: [], unreadCount: 0 };
          return await services.notifications.listForAccount(accountIds, input.limit);
        }),

      markNotificationRead: builder.markNotificationRead
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const accountIds = linkedAccountIds(context);
          if (accountIds.length === 0) {
            throw new ORPCError("UNAUTHORIZED", {
              message: "Link a NEAR account to manage notifications",
            });
          }
          const notification = await services.notifications.markRead(accountIds, input.id);
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
          const accountIds = linkedAccountIds(context);
          if (accountIds.length === 0) return { updated: 0 };
          return { updated: await services.notifications.markAllRead(accountIds) };
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
        .use(requireAuthOrApiKey)
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
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context, errors }) => {
          assertNotOrgKey(context);
          if (linkedAccountIds(context).length === 0) {
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
          return withRoundIdentity(detail);
        }),

      listRoundCredits: builder.listRoundCredits.handler(async ({ input, context, errors }) => {
        const round = await services.rounds.resolveRoundById(input.id);
        if (!round) {
          throw errors.NOT_FOUND({
            message: "Round not found",
            data: { resource: "round", resourceId: input.id },
          });
        }
        const credits = await services.rounds.listRoundCredits(round.id);
        if (!round.isPrivate) return credits;
        // Credits name the people who posted, so a private round (#101) only shows them to
        // its readers, plus each builder's own credit.
        const project = await services.projectRecords.resolveProjectById(round.projectRecordId);
        const canReadAll = canReadAllFeedback(
          round,
          project,
          await resolveActor(project, context),
          isSiteAdmin(context),
        );
        return filterVisibleFeedback(
          credits.map((credit) => ({ ...credit, authorAccountId: credit.builderAccountId })),
          canReadAll,
          linkedAccountIds(context),
        ).map(({ authorAccountId: _author, ...credit }) => credit);
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

      getTelegramTip: builder.getTelegramTip
        .use(requireAuth)
        .handler(async ({ input }) => services.telegramTip.getTip(input.accountId)),

      getProjectSearchStatus: builder.getProjectSearchStatus.handler(async () => ({
        enabled: services.projectsLookup.enabled,
      })),

      listPublicProjects: builder.listPublicProjects.handler(async () => {
        const projects = await services.projectRecords.listProjects("approved");
        return withIdentities(
          projects.map((project) => ({ ...project, rounds: project.rounds.filter(isPublic) })),
        );
      }),

      getProjectBySlug: builder.getProjectBySlug.handler(async ({ input, context }) => {
        const record = await services.projectRecords.resolveProjectBySlug(input.slug);
        const project = record && (await services.projectRecords.getProjectWithRounds(record.id));
        if (!project) throw projectNotFound(input.slug);
        const canManage = canManageProject(project, await resolveActor(project, context));
        const canSeeAll = managesRound({ canManage }, context);
        if (project.status !== "approved" && !canSeeAll) throw projectNotFound(input.slug);
        return {
          ...(await withIdentity(project)),
          rounds: canSeeAll ? project.rounds : project.rounds.filter(isPublic),
          canManage,
        };
      }),

      inviteTesters: builder.inviteTesters
        .use(requireAuthOrApiKey)
        .handler(async ({ input, context }) => {
          assertNotOrgKey(context);
          const round = await requireRound(input.id);
          await assertCanManageRound(round, context, "Only the round owner can invite testers");
          if (round.status !== "open") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Invite testers once the round is open",
            });
          }
          const from = await requireRound(input.fromRoundId);
          if (from.projectRecordId !== round.projectRecordId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Invite testers from a round of the same project",
            });
          }
          const [previous, current] = await Promise.all([
            services.rounds.listParticipants(from.id),
            services.rounds.listParticipants(round.id),
          ]);
          const joined = new Set(current.map((participant) => participant.accountId));
          const recipients = await services.notifications.notifyAccounts({
            roundId: round.id,
            kind: "round_opened",
            ...notificationText("round_opened", round.title),
            recipients: previous.filter((participant) => !joined.has(participant.accountId)),
          });
          return { recipients };
        }),

      getBuilderStanding: builder.getBuilderStanding.handler(async ({ input }) => {
        // activity owns the scoring, so a builder's standing is read back off
        // the same board the leaderboard page renders rather than recomputed.
        const board = await services.activityEvents.leaderboard({
          period: "all-time",
          limit: BUILDER_STANDING_SCAN_LIMIT,
        });
        const entry = board?.data.find((row) => row.actor === input.accountId);
        if (!entry) return null;
        return {
          accountId: input.accountId,
          rank: entry.rank,
          score: entry.score,
          eventCount: entry.eventCount,
        };
      }),

      getLeaderboard: builder.getLeaderboard.handler(async ({ input }) => {
        // No `type` filter: activity scores the whole source, so credit.awarded
        // and feedback.accepted count alongside (unscored) feedback.posted.
        const result = await services.activityEvents.leaderboard({
          period: input.period,
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

      listFailedActivityEvents: builder.listFailedActivityEvents
        .use(requireAdmin)
        .handler(async () => {
          const rows = await services.activityOutbox.listFailed();
          return rows.map(toActivityOutboxRow);
        }),

      retryFailedActivityEvents: builder.retryFailedActivityEvents
        .use(requireAdmin)
        .handler(async ({ input }) => {
          const retried = await services.activityOutbox.retryFailed(input.ids);
          return { retried };
        }),

      getActivityOutboxDepth: builder.getActivityOutboxDepth
        .use(requireAdmin)
        .handler(async () => ({ byStatus: await services.activityOutbox.depth() })),

      // Admin-only: an error-injection route is a probe surface, and it has
      // never been exercised by the regression suite despite the "regression-
      // test helper" description — nothing needs it open to the internet.
      testError: builder.testError.use(requireAdmin).handler(async ({ input }) => {
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
