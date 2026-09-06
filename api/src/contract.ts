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

export const RoundStatusSchema = z.enum(["open", "closed"]);

export const RoundFormatSchema = z.enum(["issues", "written", "recorded"]);

export const RoundSchema = z.object({
  id: z.string(),
  ownerAccountId: z.string(),
  projectSlug: z.string(),
  title: z.string(),
  description: z.string(),
  formats: z.array(RoundFormatSchema),
  repoUrl: z.string().nullable(),
  status: RoundStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
});

export type Round = z.infer<typeof RoundSchema>;

export const RoundDetailSchema = RoundSchema.extend({
  participantCount: z.number().int().nonnegative(),
});

export type RoundDetail = z.infer<typeof RoundDetailSchema>;

export const RoundFeedbackFormatSchema = z.enum(["written", "recorded"]);

export const RoundFeedbackSchema = z.object({
  id: z.string(),
  roundId: z.string(),
  authorAccountId: z.string(),
  format: RoundFeedbackFormatSchema,
  body: z.string().nullable(),
  url: z.string().nullable(),
  createdAt: z.string(),
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

export const CreditCandidateSchema = z.object({
  accountId: z.string(),
  writtenCount: z.number().int().nonnegative(),
  recordedCount: z.number().int().nonnegative(),
});

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

const CreateRoundInputSchema = z
  .object({
    projectSlug: z.string().min(1, "Project is required").max(100),
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().min(1, "Description is required").max(5000),
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
    .errors({ UNAUTHORIZED, BAD_REQUEST }),

  listRounds: oc
    .route({ method: "GET", path: "/rounds" })
    .input(z.object({ status: RoundStatusSchema.optional() }))
    .output(z.array(RoundSchema)),

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
