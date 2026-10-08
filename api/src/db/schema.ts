import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * DEAD, KEPT ON PURPOSE. No application code reads or writes this table —
 * it was unused template scaffolding with no relationship to the feedback
 * domain, and every route and UI surface for it has been removed.
 *
 * It cannot be dropped: `everything-dev`'s migration drift detector
 * (`extractExpectedTables`) scans every `CREATE TABLE` across this plugin's
 * entire migration history and never accounts for a later `DROP TABLE`, so a
 * migration that drops this table makes every future boot — including a
 * brand-new, empty database — fail with `drift-manual`, which throws and
 * refuses to start. `bos db repair` explicitly refuses to fix that
 * diagnosis too ("manual intervention required"). Confirmed by reproducing
 * it against a fresh PGlite instance; this is not an artifact of a stale
 * environment.
 *
 * Tracked upstream: https://github.com/NEARBuilders/everything-dev (file
 * before attempting to drop this or any other table).
 */
export const tenantStatus = pgEnum("tenant_status", [
  "active",
  "pending",
  "suspended",
  "pending_deletion",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subdomain: text("subdomain").notNull().unique(),
    accountId: text("account_id").notNull().unique(),
    orgId: text("org_id").notNull().unique(),
    name: text("name").notNull(),
    status: tenantStatus("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
  },
  (table) => ({
    subdomainIdx: uniqueIndex("tenants_subdomain_idx").on(table.subdomain),
    accountIdIdx: uniqueIndex("tenants_account_id_idx").on(table.accountId),
  }),
);

export const projectRoundCounters = pgTable("project_round_counters", {
  projectSlug: text("project_slug").primaryKey(),
  lastNumber: integer("last_number").default(0).notNull(),
});

export const projectStatus = pgEnum("project_status", ["pending", "approved", "rejected"]);

/**
 * Thin project anchor (#69): approvals and rounds hang off it. Created
 * implicitly when an org requests a round for a slug nobody has used yet.
 * `ownerOrgId` is null only for projects backfilled from pre-existing rounds,
 * which predate org ownership; the first round-owner to create a round claims it.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ownerOrgId: text("owner_org_id"),
    // Team (from the auth plugin) the owning org delegated round management to. Null means any org member.
    managingTeamId: text("managing_team_id"),
    // nearbuilders.org project id, when the slug resolved to a real project (#23).
    nearbuildersProjectId: text("nearbuilders_project_id"),
    status: projectStatus("status").default("pending").notNull(),
    approvedAt: timestamp("approved_at", { mode: "date", withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { mode: "date", withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("projects_slug_idx").on(table.slug),
    ownerOrgIdIdx: index("projects_owner_org_id_idx").on(table.ownerOrgId),
    statusIdx: index("projects_status_idx").on(table.status),
  }),
);

export const roundStatus = pgEnum("round_status", ["pending", "open", "closed", "rejected"]);

export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerAccountId: text("owner_account_id").notNull(),
    projectSlug: text("project_slug").notNull(),
    projectRecordId: uuid("project_record_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    projectRoundNumber: integer("project_round_number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    formats: text("formats").array().notNull(),
    repoUrl: text("repo_url"),
    // Markdown shown to testers at the top of the round workspace (#71).
    readme: text("readme").default("").notNull(),
    // Private rounds: feedback is readable only by the managing org/team, admins and each
    // submission's author (#101).
    isPrivate: boolean("is_private").default(false).notNull(),
    // Only holders of a Legion SBT can join and post (#103).
    legionOnly: boolean("legion_only").default(false).notNull(),
    status: roundStatus("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    // Set by an admin's reject decision (#48). No corresponding "approvedAt" — an
    // approval just moves status to "open" and reuses createdAt/updatedAt for that.
    rejectedAt: timestamp("rejected_at", { mode: "date", withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    activityEventId: text("activity_event_id"),
  },
  (table) => ({
    ownerAccountIdIdx: index("rounds_owner_account_id_idx").on(table.ownerAccountId),
    projectRecordIdIdx: index("rounds_project_record_id_idx").on(table.projectRecordId),
    statusIdx: index("rounds_status_idx").on(table.status),
    projectRoundNumberIdx: uniqueIndex("rounds_project_round_number_idx").on(
      table.projectSlug,
      table.projectRoundNumber,
    ),
  }),
);

export const roundParticipants = pgTable(
  "round_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roundAccountIdx: uniqueIndex("round_participants_round_account_idx").on(
      table.roundId,
      table.accountId,
    ),
    roundIdx: index("round_participants_round_idx").on(table.roundId),
    accountIdx: index("round_participants_account_idx").on(table.accountId),
  }),
);

export const roundFeedbackFormat = pgEnum("round_feedback_format", ["written", "recorded"]);

export const roundFeedbackStatus = pgEnum("round_feedback_status", [
  "unresolved",
  "resolved",
  "dismissed",
]);

export const roundFeedback = pgTable(
  "round_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    authorAccountId: text("author_account_id").notNull(),
    format: roundFeedbackFormat("format").notNull(),
    body: text("body"),
    url: text("url"),
    status: roundFeedbackStatus("status").default("unresolved").notNull(),
    statusChangedAt: timestamp("status_changed_at", { mode: "date", withTimezone: true }),
    // Standout mark set by a round manager, independent of status (#104).
    starredAt: timestamp("starred_at", { mode: "date", withTimezone: true }),
    starredByAccountId: text("starred_by_account_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    // Set when the author edits the feedback after posting; null means never edited.
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }),
    activityEventId: text("activity_event_id"),
    // Gateway id of the `feedback.accepted` event, so un-accepting can retract it.
    // Distinct from `activityEventId`, which holds the `feedback.posted` event.
    acceptedActivityEventId: text("accepted_activity_event_id"),
    nostrEventId: text("nostr_event_id"),
  },
  (table) => ({
    roundCreatedIdx: index("round_feedback_round_created_idx").on(table.roundId, table.createdAt),
  }),
);

export const feedbackNoteRole = pgEnum("feedback_note_role", ["owner", "tester"]);

export const feedbackNotes = pgTable(
  "feedback_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedbackId: uuid("feedback_id")
      .notNull()
      .references(() => roundFeedback.id, { onDelete: "cascade" }),
    authorAccountId: text("author_account_id").notNull(),
    role: feedbackNoteRole("role").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    feedbackCreatedIdx: index("feedback_notes_feedback_created_idx").on(
      table.feedbackId,
      table.createdAt,
    ),
  }),
);

export const roundCredits = pgTable(
  "round_credits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    builderAccountId: text("builder_account_id").notNull(),
    projectSlug: text("project_slug").notNull(),
    roundTitle: text("round_title").notNull(),
    contributedMeaningfully: boolean("contributed_meaningfully").default(false).notNull(),
    summary: text("summary"),
    writtenCount: integer("written_count").default(0).notNull(),
    recordedCount: integer("recorded_count").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roundBuilderIdx: uniqueIndex("round_credits_round_builder_idx").on(
      table.roundId,
      table.builderAccountId,
    ),
    builderIdx: index("round_credits_builder_idx").on(table.builderAccountId),
  }),
);

export const notificationKind = pgEnum("notification_kind", [
  "round_opened",
  "round_closing",
  "round_closed",
  "custom",
  "feedback_resolved",
  "feedback_dismissed",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientAccountId: text("recipient_account_id").notNull(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    feedbackId: uuid("feedback_id").references(() => roundFeedback.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").default("").notNull(),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    recipientCreatedIdx: index("notifications_recipient_created_idx").on(
      table.recipientAccountId,
      table.createdAt,
    ),
    recipientReadIdx: index("notifications_recipient_read_idx").on(
      table.recipientAccountId,
      table.readAt,
    ),
    roundIdx: index("notifications_round_idx").on(table.roundId),
  }),
);

export const activityOutboxOperation = pgEnum("activity_outbox_operation", ["emit", "retract"]);

export const activityOutboxStatus = pgEnum("activity_outbox_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
]);

/** The event types this app emits to activity.nearbuilders.org. */
export type ActivityEventType =
  | "round.opened"
  | "feedback.posted"
  /** A round owner accepted (resolved) a submission. The scored contribution. */
  | "feedback.accepted"
  | "round.closed"
  | "credit.awarded";

/** Where the gateway's event id is written back to once delivered. */
export type ActivitySubjectKind = "round" | "feedback" | "feedback_accepted";

/**
 * Durable queue for activity.nearbuilders.org submissions.
 *
 * activity is the sole source of truth for tester reputation, so emission can
 * no longer be fire-and-forget: rows are written in the same transaction as the
 * domain change that caused them, and a worker drains them with retry. A
 * gateway outage delays events, it never loses them.
 *
 * `subjectKind`/`subjectId` tell the worker where to write the gateway's event
 * id back to, so a later retraction can reference it.
 */
export const activityOutbox = pgTable(
  "activity_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operation: activityOutboxOperation("operation").notNull(),
    // Set for `emit`; null for `retract`.
    eventType: text("event_type").$type<ActivityEventType>(),
    actor: text("actor"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    // Set for `retract`: the gateway event id being hidden, and why.
    targetEventId: text("target_event_id"),
    reason: text("reason"),
    // Deduped by the gateway, and used here to cancel a still-pending emit.
    idempotencyKey: text("idempotency_key").notNull(),
    // Where to write `eventId` back to, as an `ActivitySubjectKind`.
    subjectKind: text("subject_kind").$type<ActivitySubjectKind>(),
    subjectId: uuid("subject_id"),
    status: activityOutboxStatus("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    eventId: text("event_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
  },
  (table) => ({
    idempotencyKeyIdx: uniqueIndex("activity_outbox_idempotency_key_idx").on(table.idempotencyKey),
    dueIdx: index("activity_outbox_due_idx").on(table.status, table.nextAttemptAt),
  }),
);
