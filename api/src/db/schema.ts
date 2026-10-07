import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
    // nearbuilders.org project id this round resolved against, if the owner
    // picked a real project rather than typing a free-text slug (#23).
    projectId: text("project_id"),
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
    activityEventId: text("activity_event_id"),
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
