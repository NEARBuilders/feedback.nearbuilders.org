import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const ErrorTestKindSchema = z.enum([
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "bad_request",
  "internal",
]);

export const TenantStatusSchema = z.enum(["active", "pending", "suspended", "pending_deletion"]);

export const TenantSchema = z.object({
  id: z.string(),
  subdomain: z.string(),
  accountId: z.string(),
  orgId: z.string(),
  name: z.string(),
  status: TenantStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type Tenant = z.infer<typeof TenantSchema>;

// "in_progress" (auto-locked once tester slots fill) is part of the README's
// full planned lifecycle but depends on a signup/slot-selection system that
// doesn't exist yet — out of scope here (#48 only covers the pending admin
// gate). Rounds today go straight from "open" to "closed".
export const RoundStatusSchema = z.enum(["pending", "open", "closed", "rejected"]);

export const RoundFormatSchema = z.enum(["issues", "written", "recorded"]);

export const ProjectStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const ProjectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  /** Null only for projects backfilled from rounds that predate org ownership. */
  ownerOrgId: z.string().nullable(),
  nearbuildersProjectId: z.string().nullable(),
  status: ProjectStatusSchema,
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectWithRoundsSchema = ProjectSchema.extend({
  rounds: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(["pending", "open", "closed", "rejected"]),
      projectRoundNumber: z.number().int().positive(),
    }),
  ),
});

export type ProjectWithRounds = z.infer<typeof ProjectWithRoundsSchema>;

export const RoundSchema = z.object({
  id: z.string(),
  ownerAccountId: z.string(),
  projectSlug: z.string(),
  /** nearbuilders.org project id this round resolved against, if any (#23). */
  projectId: z.string().nullable(),
  /** The approved-project anchor this round hangs off (#69). */
  projectRecordId: z.string(),
  projectRoundNumber: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  /** Markdown for testers: what to test and how (#71). Empty string when unset. */
  readme: z.string(),
  formats: z.array(RoundFormatSchema),
  repoUrl: z.string().nullable(),
  status: RoundStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});

export type Round = z.infer<typeof RoundSchema>;

export const RoundDetailSchema = RoundSchema.extend({
  participantCount: z.number().int().nonnegative(),
  /** Whether the caller's org owns this round's project (#70). Only set by getRound. */
  canManage: z.boolean().optional(),
});

export type RoundDetail = z.infer<typeof RoundDetailSchema>;

export const RoundFeedbackFormatSchema = z.enum(["written", "recorded"]);

export const RoundParticipantSchema = z.object({
  accountId: z.string(),
  joinedAt: z.string(),
});

export type RoundParticipant = z.infer<typeof RoundParticipantSchema>;

export const RoundFeedbackStatusSchema = z.enum(["unresolved", "resolved", "dismissed"]);

export type RoundFeedbackStatus = z.infer<typeof RoundFeedbackStatusSchema>;

export const RoundFeedbackSchema = z.object({
  id: z.string(),
  roundId: z.string(),
  authorAccountId: z.string(),
  format: RoundFeedbackFormatSchema,
  body: z.string().nullable(),
  url: z.string().nullable(),
  status: RoundFeedbackStatusSchema,
  createdAt: z.string(),
  nostrEventId: z.string().nullable(),
});

export type RoundFeedback = z.infer<typeof RoundFeedbackSchema>;

export const RoundCreditSchema = z.object({
  id: z.string(),
  roundId: z.string(),
  builderAccountId: z.string(),
  projectSlug: z.string(),
  roundTitle: z.string(),
  contributedMeaningfully: z.boolean(),
  summary: z.string().nullable(),
  writtenCount: z.number().int().nonnegative(),
  recordedCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type RoundCredit = z.infer<typeof RoundCreditSchema>;

export const NotificationKindSchema = z.enum([
  "round_opened",
  "round_closing",
  "round_closed",
  "custom",
]);

export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  roundId: z.string(),
  roundTitle: z.string(),
  kind: NotificationKindSchema,
  title: z.string(),
  body: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationListSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().int().nonnegative(),
});

export type NotificationList = z.infer<typeof NotificationListSchema>;

export const BroadcastKindSchema = z.enum(["round_opened", "round_closing", "custom"]);

export type BroadcastKind = z.infer<typeof BroadcastKindSchema>;

const MAX_BROADCAST_LENGTH = 1000;

const BroadcastInputSchema = z
  .object({
    id: z.string(),
    kind: BroadcastKindSchema,
    message: z.string().trim().max(MAX_BROADCAST_LENGTH).optional(),
  })
  .refine((v) => v.kind !== "custom" || !!v.message, {
    message: "A custom broadcast needs a message",
    path: ["message"],
  });

export const GithubIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  url: z.string(),
  createdAt: z.string(),
});

export const GithubIssueContributorSchema = z.object({
  login: z.string(),
  issues: z.array(GithubIssueSchema),
});

export type GithubIssueContributor = z.infer<typeof GithubIssueContributorSchema>;

export const RoundGithubIssuesSchema = z.object({
  repoUrl: z.string(),
  windowStart: z.string(),
  windowEnd: z.string().nullable(),
  contributors: z.array(GithubIssueContributorSchema),
});

export type RoundGithubIssues = z.infer<typeof RoundGithubIssuesSchema>;

export const BuilderRoundSchema = z.object({
  roundId: z.string(),
  roundTitle: z.string(),
  projectSlug: z.string(),
  repoUrl: z.string().nullable(),
  issuesUrl: z.string().nullable(),
  contributedMeaningfully: z.boolean(),
  summary: z.string().nullable(),
  writtenCount: z.number().int().nonnegative(),
  recordedCount: z.number().int().nonnegative(),
  closedAt: z.string(),
  creditedAt: z.string(),
});

export type BuilderRound = z.infer<typeof BuilderRoundSchema>;

export const MyJoinedRoundSchema = z.object({
  roundId: z.string(),
  roundTitle: z.string(),
  projectSlug: z.string(),
  status: RoundStatusSchema,
  formats: z.array(RoundFormatSchema),
  participantCount: z.number().int().nonnegative(),
  joinedAt: z.string(),
});

export type MyJoinedRound = z.infer<typeof MyJoinedRoundSchema>;

export const CreditCandidateSchema = z.object({
  accountId: z.string(),
  writtenCount: z.number().int().nonnegative(),
  recordedCount: z.number().int().nonnegative(),
});

export const LeaderboardPeriodSchema = z.enum(["weekly", "monthly", "all-time"]);

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  actor: z.string(),
  score: z.number(),
  eventCount: z.number().int().nonnegative(),
});

export const LeaderboardSchema = z.object({
  period: LeaderboardPeriodSchema,
  /** False when no activity gateway URL is configured. */
  configured: z.boolean(),
  /** False when the gateway is unconfigured or the request to it failed. */
  available: z.boolean(),
  data: z.array(LeaderboardEntrySchema),
});

export type Leaderboard = z.infer<typeof LeaderboardSchema>;

export const RoundEndorsementSchema = z.object({
  eventId: z.string(),
  totalCount: z.number().int().nonnegative(),
});

export type RoundEndorsement = z.infer<typeof RoundEndorsementSchema>;

export const BuilderActivityEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceDisplayName: z.string(),
  type: z.string(),
  timestamp: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export type BuilderActivityEvent = z.infer<typeof BuilderActivityEventSchema>;

export const NearBuildersProjectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  kind: z.enum(["project", "idea", "scope", "result"]),
  status: z.enum(["active", "paused", "archived"]),
  visibility: z.enum(["private", "unlisted", "public"]),
});

export type NearBuildersProject = z.infer<typeof NearBuildersProjectSchema>;

export const ProjectSearchResultSchema = z.object({
  available: z.boolean(),
  results: z.array(NearBuildersProjectSchema),
});

export type ProjectSearchResult = z.infer<typeof ProjectSearchResultSchema>;

const PostFeedbackInputSchema = z
  .object({
    id: z.string(),
    format: RoundFeedbackFormatSchema,
    body: z.string().max(5000).optional(),
    url: z.string().url("Must be a valid URL").optional(),
  })
  .refine((v) => v.format !== "written" || !!v.body?.trim(), {
    message: "Written feedback needs a non-empty body",
    path: ["body"],
  })
  .refine((v) => v.format !== "recorded" || !!v.url, {
    message: "Recorded feedback needs a session link",
    path: ["url"],
  });

const MAX_README_LENGTH = 20000;

const CreateRoundInputSchema = z
  .object({
    projectSlug: z.string().min(1, "Project is required").max(100),
    /** nearbuilders.org project id from the picker, when the slug resolved to a real project (#23). */
    projectId: z.string().min(1).optional(),
    /** Display name for the project if this request creates it (e.g. the picker's title). */
    projectName: z.string().trim().min(1).max(200).optional(),
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().min(1, "Description is required").max(5000),
    readme: z.string().max(MAX_README_LENGTH).optional(),
    formats: z.array(RoundFormatSchema).min(1, "Select at least one feedback format"),
    repoUrl: z.string().url("Must be a valid URL").optional(),
  })
  .refine((val) => !val.formats.includes("issues") || !!val.repoUrl, {
    message: "A repo URL is required when the issues format is selected",
    path: ["repoUrl"],
  });

export const contract = oc.router({
  ping: oc.route({ method: "GET", path: "/ping" }).output(
    z.object({
      status: z.literal("ok"),
      timestamp: z.iso.datetime(),
    }),
  ),

  authHealth: oc
    .route({ method: "GET", path: "/auth/health" })
    .output(
      z.object({
        status: z.string(),
        emailConfigured: z.boolean(),
        smsConfigured: z.boolean(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  listTenants: oc
    .route({ method: "GET", path: "/tenants" })
    .output(z.array(TenantSchema))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  createTenant: oc
    .route({ method: "POST", path: "/tenants" })
    .input(
      z.object({
        subdomain: z.string(),
        name: z.string(),
        accountId: z.string(),
        status: z.enum(["active", "pending"]).optional(),
      }),
    )
    .output(TenantSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  updateTenant: oc
    .route({ method: "PATCH", path: "/tenants/{tenantId}" })
    .input(
      z.object({
        tenantId: z.string(),
        name: z.string().optional(),
        subdomain: z.string().optional(),
        accountId: z.string().optional(),
        status: TenantStatusSchema.optional(),
      }),
    )
    .output(TenantSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  deleteTenant: oc
    .route({ method: "POST", path: "/tenants/{tenantId}/delete" })
    .input(z.object({ tenantId: z.string() }))
    .output(TenantSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  suspendTenant: oc
    .route({ method: "POST", path: "/tenants/{tenantId}/suspend" })
    .input(z.object({ tenantId: z.string() }))
    .output(TenantSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  reactivateTenant: oc
    .route({ method: "POST", path: "/tenants/{tenantId}/reactivate" })
    .input(z.object({ tenantId: z.string() }))
    .output(TenantSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  resolveTenant: oc
    .route({ method: "GET", path: "/tenants/account/{accountId}" })
    .input(z.object({ accountId: z.string() }))
    .output(TenantSchema.nullable()),

  resolveTenantByOrgId: oc
    .route({ method: "GET", path: "/tenants/org/{orgId}" })
    .input(z.object({ orgId: z.string() }))
    .output(TenantSchema)
    .errors({ NOT_FOUND }),

  tenantPreflight: oc
    .route({ method: "POST", path: "/tenants/preflight" })
    .input(
      z.object({
        subdomain: z.string(),
        parentAccount: z.string(),
      }),
    )
    .output(
      z.object({
        subdomain: z.object({
          available: z.boolean(),
          reserved: z.boolean(),
        }),
        accountId: z.object({
          format: z.enum(["valid", "invalid"]),
          available: z.boolean(),
        }),
      }),
    )
    .errors({ UNAUTHORIZED, BAD_REQUEST }),

  createRound: oc
    .route({ method: "POST", path: "/rounds" })
    .input(CreateRoundInputSchema)
    .output(RoundSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  updateRoundReadme: oc
    .route({ method: "PATCH", path: "/rounds/{id}/readme" })
    .input(z.object({ id: z.string(), readme: z.string().max(MAX_README_LENGTH) }))
    .output(RoundSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  listRounds: oc
    .route({ method: "GET", path: "/rounds" })
    .input(z.object({ status: RoundStatusSchema.optional() }))
    .output(z.array(RoundDetailSchema))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  listProjects: oc
    .route({ method: "GET", path: "/projects" })
    .input(z.object({ status: ProjectStatusSchema.optional() }))
    .output(z.array(ProjectWithRoundsSchema))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  listMyProjects: oc
    .route({ method: "GET", path: "/projects/mine" })
    .output(z.array(ProjectWithRoundsSchema))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  approveProject: oc
    .route({ method: "POST", path: "/projects/{id}/approve" })
    .input(z.object({ id: z.string() }))
    .output(ProjectWithRoundsSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),

  rejectProject: oc
    .route({ method: "POST", path: "/projects/{id}/reject" })
    .input(
      z.object({
        id: z.string(),
        reason: z.string().trim().min(1, "A reason is required").max(2000),
      }),
    )
    .output(ProjectWithRoundsSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),

  deleteRound: oc
    .route({ method: "DELETE", path: "/rounds/{id}" })
    .input(z.object({ id: z.string() }))
    .output(RoundSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),

  getRound: oc
    .route({ method: "GET", path: "/rounds/{id}" })
    .input(z.object({ id: z.string() }))
    .output(RoundDetailSchema)
    .errors({ NOT_FOUND }),

  joinRound: oc
    .route({ method: "POST", path: "/rounds/{id}/join" })
    .input(z.object({ id: z.string() }))
    .output(RoundDetailSchema)
    .errors({ UNAUTHORIZED, BAD_REQUEST, NOT_FOUND }),

  leaveRound: oc
    .route({ method: "DELETE", path: "/rounds/{id}/join" })
    .input(z.object({ id: z.string() }))
    .output(RoundDetailSchema)
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  getMyParticipation: oc
    .route({ method: "GET", path: "/rounds/{id}/join" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ joined: z.boolean() }))
    .errors({ UNAUTHORIZED }),

  listMyJoinedRounds: oc
    .route({ method: "GET", path: "/rounds/joined" })
    .output(z.array(MyJoinedRoundSchema))
    .errors({ UNAUTHORIZED, BAD_REQUEST }),

  postFeedback: oc
    .route({ method: "POST", path: "/rounds/{id}/feedback" })
    .input(PostFeedbackInputSchema)
    .output(RoundFeedbackSchema)
    .errors({ UNAUTHORIZED, BAD_REQUEST, FORBIDDEN, NOT_FOUND }),

  listFeedback: oc
    .route({ method: "GET", path: "/rounds/{id}/feedback" })
    .input(z.object({ id: z.string() }))
    .output(z.array(RoundFeedbackSchema))
    .errors({ NOT_FOUND }),

  deleteFeedback: oc
    .route({ method: "DELETE", path: "/rounds/{id}/feedback/{feedbackId}" })
    .input(z.object({ id: z.string(), feedbackId: z.string() }))
    .output(RoundFeedbackSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  setFeedbackStatus: oc
    .route({ method: "PATCH", path: "/rounds/{id}/feedback/status" })
    .input(
      z.object({
        id: z.string(),
        feedbackIds: z.array(z.string()).min(1).max(500),
        status: RoundFeedbackStatusSchema,
      }),
    )
    .output(z.array(RoundFeedbackSchema))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  listParticipants: oc
    .route({ method: "GET", path: "/rounds/{id}/participants" })
    .input(z.object({ id: z.string() }))
    .output(z.array(RoundParticipantSchema))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  broadcastToRound: oc
    .route({ method: "POST", path: "/rounds/{id}/broadcast" })
    .input(BroadcastInputSchema)
    .output(z.object({ recipients: z.number().int().nonnegative() }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),

  listNotifications: oc
    .route({ method: "GET", path: "/notifications" })
    .input(z.object({ limit: z.number().int().positive().max(100).default(30) }))
    .output(NotificationListSchema)
    .errors({ UNAUTHORIZED }),

  markNotificationRead: oc
    .route({ method: "POST", path: "/notifications/{id}/read" })
    .input(z.object({ id: z.string() }))
    .output(NotificationSchema)
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  markAllNotificationsRead: oc
    .route({ method: "POST", path: "/notifications/read-all" })
    .output(z.object({ updated: z.number().int().nonnegative() }))
    .errors({ UNAUTHORIZED }),

  getRoundGithubIssues: oc
    .route({ method: "GET", path: "/rounds/{id}/github-issues" })
    .input(z.object({ id: z.string() }))
    .output(RoundGithubIssuesSchema)
    .errors({ NOT_FOUND, BAD_REQUEST }),

  getCreditCandidates: oc
    .route({ method: "GET", path: "/rounds/{id}/credit-candidates" })
    .input(z.object({ id: z.string() }))
    .output(z.array(CreditCandidateSchema))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  closeRound: oc
    .route({ method: "POST", path: "/rounds/{id}/close" })
    .input(
      z.object({
        id: z.string(),
        credits: z
          .array(
            z.object({
              builderAccountId: z.string(),
              contributedMeaningfully: z.boolean(),
              summary: z.string().max(2000).optional(),
            }),
          )
          .optional(),
      }),
    )
    .output(RoundDetailSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),

  listRoundCredits: oc
    .route({ method: "GET", path: "/rounds/{id}/credits" })
    .input(z.object({ id: z.string() }))
    .output(z.array(RoundCreditSchema))
    .errors({ NOT_FOUND }),

  getBuilderRounds: oc
    .route({ method: "GET", path: "/builders/{accountId}/rounds" })
    .input(z.object({ accountId: z.string() }))
    .output(z.array(BuilderRoundSchema)),

  getRoundEndorsements: oc
    .route({ method: "GET", path: "/activity/endorsements" })
    .input(z.object({ roundIds: z.array(z.string()).max(100) }))
    .output(z.record(z.string(), RoundEndorsementSchema)),

  getBuilderActivity: oc
    .route({ method: "GET", path: "/builders/{accountId}/activity" })
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .output(z.array(BuilderActivityEventSchema)),

  searchProjects: oc
    .route({ method: "GET", path: "/projects/search" })
    .input(z.object({ query: z.string().trim().min(1).max(200) }))
    .output(ProjectSearchResultSchema),

  getProjectSearchStatus: oc
    .route({ method: "GET", path: "/projects/search/status" })
    .output(z.object({ enabled: z.boolean() })),

  resolveProjectBySlug: oc
    .route({ method: "GET", path: "/projects/by-slug/{slug}" })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .output(NearBuildersProjectSchema.nullable()),

  getLeaderboard: oc
    .route({ method: "GET", path: "/activity/leaderboard" })
    .input(
      z.object({
        period: LeaderboardPeriodSchema.default("all-time"),
        limit: z.number().int().positive().max(100).optional(),
      }),
    )
    .output(LeaderboardSchema),

  testError: oc
    .route({
      method: "GET",
      path: "/errors",
      summary: "Trigger a specific error kind",
      description:
        "Regression-test helper that throws the requested error kind so the host error surface can be validated.",
      tags: ["Testing"],
    })
    .input(
      z.object({
        kind: ErrorTestKindSchema.describe("Which error kind to trigger"),
      }),
    )
    .output(
      z.object({
        ok: z.literal(true).describe("Always true when no error is thrown"),
      }),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),
});

export type ContractType = typeof contract;
