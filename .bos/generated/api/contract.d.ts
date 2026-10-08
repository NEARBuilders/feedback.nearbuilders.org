import { z } from "every-plugin/zod";
export declare const RoundStatusSchema: z.ZodEnum<{
    pending: "pending";
    open: "open";
    closed: "closed";
    rejected: "rejected";
}>;
export declare const RoundFormatSchema: z.ZodEnum<{
    issues: "issues";
    written: "written";
    recorded: "recorded";
}>;
export declare const ProjectStatusSchema: z.ZodEnum<{
    pending: "pending";
    rejected: "rejected";
    approved: "approved";
}>;
export declare const ProjectSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    ownerOrgId: z.ZodNullable<z.ZodString>;
    managingTeamId: z.ZodNullable<z.ZodString>;
    nearbuildersProjectId: z.ZodNullable<z.ZodString>;
    contact: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        pending: "pending";
        rejected: "rejected";
        approved: "approved";
    }>;
    approvedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    verifiedByAccountId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type Project = z.infer<typeof ProjectSchema>;
/**
 * Identity resolved from the nearbuilders.org registry, which owns it. Null
 * when the registry has no entry for the slug or is unreachable — this app
 * deliberately keeps no mirrored copy to drift out of date.
 */
export declare const ProjectIdentitySchema: z.ZodNullable<z.ZodObject<{
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    domain: z.ZodNullable<z.ZodString>;
    repository: z.ZodNullable<z.ZodString>;
    logoUrl: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<{
        project: "project";
        idea: "idea";
        scope: "scope";
        result: "result";
    }>;
}, z.core.$strip>>;
export type ProjectIdentity = z.infer<typeof ProjectIdentitySchema>;
export declare const ProjectWithRoundsSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    ownerOrgId: z.ZodNullable<z.ZodString>;
    managingTeamId: z.ZodNullable<z.ZodString>;
    nearbuildersProjectId: z.ZodNullable<z.ZodString>;
    contact: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        pending: "pending";
        rejected: "rejected";
        approved: "approved";
    }>;
    approvedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    verifiedByAccountId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    identity: z.ZodNullable<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        domain: z.ZodNullable<z.ZodString>;
        repository: z.ZodNullable<z.ZodString>;
        logoUrl: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            project: "project";
            idea: "idea";
            scope: "scope";
            result: "result";
        }>;
    }, z.core.$strip>>;
    rounds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        projectRoundNumber: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ProjectWithRounds = z.infer<typeof ProjectWithRoundsSchema>;
export declare const RoundSchema: z.ZodObject<{
    id: z.ZodString;
    ownerAccountId: z.ZodString;
    projectSlug: z.ZodString;
    projectRecordId: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodString;
    readme: z.ZodString;
    formats: z.ZodArray<z.ZodEnum<{
        issues: "issues";
        written: "written";
        recorded: "recorded";
    }>>;
    repoUrl: z.ZodNullable<z.ZodString>;
    isPrivate: z.ZodBoolean;
    legionOnly: z.ZodBoolean;
    status: z.ZodEnum<{
        pending: "pending";
        open: "open";
        closed: "closed";
        rejected: "rejected";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type Round = z.infer<typeof RoundSchema>;
export declare const RoundDetailSchema: z.ZodObject<{
    id: z.ZodString;
    ownerAccountId: z.ZodString;
    projectSlug: z.ZodString;
    projectRecordId: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodString;
    readme: z.ZodString;
    formats: z.ZodArray<z.ZodEnum<{
        issues: "issues";
        written: "written";
        recorded: "recorded";
    }>>;
    repoUrl: z.ZodNullable<z.ZodString>;
    isPrivate: z.ZodBoolean;
    legionOnly: z.ZodBoolean;
    status: z.ZodEnum<{
        pending: "pending";
        open: "open";
        closed: "closed";
        rejected: "rejected";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    identity: z.ZodNullable<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        domain: z.ZodNullable<z.ZodString>;
        repository: z.ZodNullable<z.ZodString>;
        logoUrl: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            project: "project";
            idea: "idea";
            scope: "scope";
            result: "result";
        }>;
    }, z.core.$strip>>;
    participantCount: z.ZodNumber;
    participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
    feedbackCount: z.ZodOptional<z.ZodNumber>;
    canManage: z.ZodOptional<z.ZodBoolean>;
    projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type RoundDetail = z.infer<typeof RoundDetailSchema>;
export declare const RoundFeedbackFormatSchema: z.ZodEnum<{
    written: "written";
    recorded: "recorded";
}>;
export declare const RoundParticipantSchema: z.ZodObject<{
    accountId: z.ZodString;
    joinedAt: z.ZodString;
    feedbackCount: z.ZodNumber;
}, z.core.$strip>;
export type RoundParticipant = z.infer<typeof RoundParticipantSchema>;
export declare const RoundFeedbackStatusSchema: z.ZodEnum<{
    unresolved: "unresolved";
    resolved: "resolved";
    dismissed: "dismissed";
}>;
export type RoundFeedbackStatus = z.infer<typeof RoundFeedbackStatusSchema>;
export declare const RoundFeedbackSchema: z.ZodObject<{
    id: z.ZodString;
    roundId: z.ZodString;
    authorAccountId: z.ZodString;
    format: z.ZodEnum<{
        written: "written";
        recorded: "recorded";
    }>;
    body: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        unresolved: "unresolved";
        resolved: "resolved";
        dismissed: "dismissed";
    }>;
    starredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodNullable<z.ZodString>;
    nostrEventId: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type RoundFeedback = z.infer<typeof RoundFeedbackSchema>;
export declare const FeedbackNoteSchema: z.ZodObject<{
    id: z.ZodString;
    feedbackId: z.ZodString;
    authorAccountId: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        tester: "tester";
    }>;
    body: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type FeedbackNote = z.infer<typeof FeedbackNoteSchema>;
export declare const FeedbackDetailSchema: z.ZodObject<{
    id: z.ZodString;
    roundId: z.ZodString;
    authorAccountId: z.ZodString;
    format: z.ZodEnum<{
        written: "written";
        recorded: "recorded";
    }>;
    body: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        unresolved: "unresolved";
        resolved: "resolved";
        dismissed: "dismissed";
    }>;
    starredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodNullable<z.ZodString>;
    nostrEventId: z.ZodNullable<z.ZodString>;
    notes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        feedbackId: z.ZodString;
        authorAccountId: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            tester: "tester";
        }>;
        body: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type FeedbackDetail = z.infer<typeof FeedbackDetailSchema>;
export declare const MyFeedbackSchema: z.ZodObject<{
    id: z.ZodString;
    roundId: z.ZodString;
    authorAccountId: z.ZodString;
    format: z.ZodEnum<{
        written: "written";
        recorded: "recorded";
    }>;
    body: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        unresolved: "unresolved";
        resolved: "resolved";
        dismissed: "dismissed";
    }>;
    starredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodNullable<z.ZodString>;
    nostrEventId: z.ZodNullable<z.ZodString>;
    notes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        feedbackId: z.ZodString;
        authorAccountId: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            tester: "tester";
        }>;
        body: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MyFeedback = z.infer<typeof MyFeedbackSchema>;
export declare const FeedbackPageSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type FeedbackPage = z.infer<typeof FeedbackPageSchema>;
export declare const RoundCreditSchema: z.ZodObject<{
    id: z.ZodString;
    roundId: z.ZodString;
    builderAccountId: z.ZodString;
    projectSlug: z.ZodString;
    roundTitle: z.ZodString;
    contributedMeaningfully: z.ZodBoolean;
    summary: z.ZodNullable<z.ZodString>;
    writtenCount: z.ZodNumber;
    recordedCount: z.ZodNumber;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type RoundCredit = z.infer<typeof RoundCreditSchema>;
export declare const NotificationKindSchema: z.ZodEnum<{
    custom: "custom";
    round_opened: "round_opened";
    round_closing: "round_closing";
    round_closed: "round_closed";
    feedback_resolved: "feedback_resolved";
    feedback_dismissed: "feedback_dismissed";
}>;
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
export declare const NotificationSchema: z.ZodObject<{
    id: z.ZodString;
    roundId: z.ZodString;
    roundTitle: z.ZodString;
    projectSlug: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    feedbackId: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<{
        custom: "custom";
        round_opened: "round_opened";
        round_closing: "round_closing";
        round_closed: "round_closed";
        feedback_resolved: "feedback_resolved";
        feedback_dismissed: "feedback_dismissed";
    }>;
    title: z.ZodString;
    body: z.ZodString;
    readAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type Notification = z.infer<typeof NotificationSchema>;
export declare const NotificationListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        roundTitle: z.ZodString;
        projectSlug: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        feedbackId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            custom: "custom";
            round_opened: "round_opened";
            round_closing: "round_closing";
            round_closed: "round_closed";
            feedback_resolved: "feedback_resolved";
            feedback_dismissed: "feedback_dismissed";
        }>;
        title: z.ZodString;
        body: z.ZodString;
        readAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    unreadCount: z.ZodNumber;
}, z.core.$strip>;
export type NotificationList = z.infer<typeof NotificationListSchema>;
export declare const BroadcastKindSchema: z.ZodEnum<{
    custom: "custom";
    round_opened: "round_opened";
    round_closing: "round_closing";
}>;
export type BroadcastKind = z.infer<typeof BroadcastKindSchema>;
export declare const GithubIssueSchema: z.ZodObject<{
    number: z.ZodNumber;
    title: z.ZodString;
    url: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>;
export declare const GithubIssueContributorSchema: z.ZodObject<{
    login: z.ZodString;
    issues: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        url: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type GithubIssueContributor = z.infer<typeof GithubIssueContributorSchema>;
export declare const RoundGithubIssuesSchema: z.ZodObject<{
    repoUrl: z.ZodString;
    windowStart: z.ZodString;
    windowEnd: z.ZodNullable<z.ZodString>;
    contributors: z.ZodArray<z.ZodObject<{
        login: z.ZodString;
        issues: z.ZodArray<z.ZodObject<{
            number: z.ZodNumber;
            title: z.ZodString;
            url: z.ZodString;
            createdAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RoundGithubIssues = z.infer<typeof RoundGithubIssuesSchema>;
export declare const BuilderRoundSchema: z.ZodObject<{
    roundId: z.ZodString;
    roundTitle: z.ZodString;
    projectSlug: z.ZodString;
    repoUrl: z.ZodNullable<z.ZodString>;
    issuesUrl: z.ZodNullable<z.ZodString>;
    contributedMeaningfully: z.ZodBoolean;
    summary: z.ZodNullable<z.ZodString>;
    writtenCount: z.ZodNumber;
    recordedCount: z.ZodNumber;
    closedAt: z.ZodString;
    creditedAt: z.ZodString;
}, z.core.$strip>;
export type BuilderRound = z.infer<typeof BuilderRoundSchema>;
export declare const MyJoinedRoundSchema: z.ZodObject<{
    roundId: z.ZodString;
    roundTitle: z.ZodString;
    projectSlug: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    status: z.ZodEnum<{
        pending: "pending";
        open: "open";
        closed: "closed";
        rejected: "rejected";
    }>;
    formats: z.ZodArray<z.ZodEnum<{
        issues: "issues";
        written: "written";
        recorded: "recorded";
    }>>;
    readme: z.ZodString;
    repoUrl: z.ZodNullable<z.ZodString>;
    participantCount: z.ZodNumber;
    myFeedbackCount: z.ZodNumber;
    joinedAt: z.ZodString;
}, z.core.$strip>;
/** Counts for the owner's home-page overview; nothing here is scoped to one round. */
export declare const OwnerSummarySchema: z.ZodObject<{
    openRounds: z.ZodNumber;
    unresolvedFeedback: z.ZodNumber;
    pendingProjects: z.ZodNumber;
}, z.core.$strip>;
export type OwnerSummary = z.infer<typeof OwnerSummarySchema>;
export type MyJoinedRound = z.infer<typeof MyJoinedRoundSchema>;
export declare const CreditCandidateSchema: z.ZodObject<{
    accountId: z.ZodString;
    writtenCount: z.ZodNumber;
    recordedCount: z.ZodNumber;
}, z.core.$strip>;
export declare const LeaderboardPeriodSchema: z.ZodEnum<{
    weekly: "weekly";
    monthly: "monthly";
    "all-time": "all-time";
}>;
export declare const LeaderboardEntrySchema: z.ZodObject<{
    rank: z.ZodNumber;
    actor: z.ZodString;
    score: z.ZodNumber;
    eventCount: z.ZodNumber;
}, z.core.$strip>;
export declare const LeaderboardSchema: z.ZodObject<{
    period: z.ZodEnum<{
        weekly: "weekly";
        monthly: "monthly";
        "all-time": "all-time";
    }>;
    configured: z.ZodBoolean;
    available: z.ZodBoolean;
    data: z.ZodArray<z.ZodObject<{
        rank: z.ZodNumber;
        actor: z.ZodString;
        score: z.ZodNumber;
        eventCount: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
/**
 * One builder's all-time standing, read from activity rather than computed here.
 * `null` when the gateway is unreachable or the builder has not scored yet.
 */
export declare const BuilderStandingSchema: z.ZodNullable<z.ZodObject<{
    accountId: z.ZodString;
    rank: z.ZodNumber;
    score: z.ZodNumber;
    eventCount: z.ZodNumber;
}, z.core.$strip>>;
export type BuilderStanding = z.infer<typeof BuilderStandingSchema>;
export declare const RoundEndorsementSchema: z.ZodObject<{
    eventId: z.ZodString;
    totalCount: z.ZodNumber;
}, z.core.$strip>;
export type RoundEndorsement = z.infer<typeof RoundEndorsementSchema>;
export declare const BuilderActivityEventSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodString;
    sourceDisplayName: z.ZodString;
    type: z.ZodString;
    timestamp: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type BuilderActivityEvent = z.infer<typeof BuilderActivityEventSchema>;
/**
 * One undeliverable row from the activity outbox, for operator inspection.
 * Dates arrive as ISO strings; the local Date objects are serialized by the
 * handler before returning.
 */
export declare const ActivityOutboxRowSchema: z.ZodObject<{
    id: z.ZodUUID;
    operation: z.ZodEnum<{
        emit: "emit";
        retract: "retract";
    }>;
    eventType: z.ZodNullable<z.ZodString>;
    actor: z.ZodNullable<z.ZodString>;
    payload: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    targetEventId: z.ZodNullable<z.ZodString>;
    reason: z.ZodNullable<z.ZodString>;
    idempotencyKey: z.ZodString;
    subjectKind: z.ZodNullable<z.ZodString>;
    subjectId: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        pending: "pending";
        sent: "sent";
        failed: "failed";
        cancelled: "cancelled";
    }>;
    attempts: z.ZodNumber;
    lastError: z.ZodNullable<z.ZodString>;
    nextAttemptAt: z.ZodISODateTime;
    eventId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
    sentAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export type ActivityOutboxRow = z.infer<typeof ActivityOutboxRowSchema>;
export declare const NearBuildersProjectSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    kind: z.ZodEnum<{
        project: "project";
        idea: "idea";
        scope: "scope";
        result: "result";
    }>;
    status: z.ZodEnum<{
        active: "active";
        paused: "paused";
        archived: "archived";
    }>;
    visibility: z.ZodEnum<{
        private: "private";
        unlisted: "unlisted";
        public: "public";
    }>;
    domain: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    repository: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    logoUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
}, z.core.$strip>;
export type NearBuildersProject = z.infer<typeof NearBuildersProjectSchema>;
export declare const ProjectDetailSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    ownerOrgId: z.ZodNullable<z.ZodString>;
    managingTeamId: z.ZodNullable<z.ZodString>;
    nearbuildersProjectId: z.ZodNullable<z.ZodString>;
    contact: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        pending: "pending";
        rejected: "rejected";
        approved: "approved";
    }>;
    approvedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    verifiedByAccountId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    identity: z.ZodNullable<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        domain: z.ZodNullable<z.ZodString>;
        repository: z.ZodNullable<z.ZodString>;
        logoUrl: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            project: "project";
            idea: "idea";
            scope: "scope";
            result: "result";
        }>;
    }, z.core.$strip>>;
    rounds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        projectRoundNumber: z.ZodNumber;
    }, z.core.$strip>>;
    canManage: z.ZodBoolean;
}, z.core.$strip>;
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
export declare const ProjectSearchResultSchema: z.ZodObject<{
    available: z.ZodBoolean;
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
        kind: z.ZodEnum<{
            project: "project";
            idea: "idea";
            scope: "scope";
            result: "result";
        }>;
        status: z.ZodEnum<{
            active: "active";
            paused: "paused";
            archived: "archived";
        }>;
        visibility: z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>;
        domain: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
        repository: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
        logoUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ProjectSearchResult = z.infer<typeof ProjectSearchResultSchema>;
export declare const TelegramTipSchema: z.ZodObject<{
    handle: z.ZodNullable<z.ZodString>;
    source: z.ZodNullable<z.ZodEnum<{
        nearbuilders: "nearbuilders";
        "near-social": "near-social";
    }>>;
    available: z.ZodBoolean;
    message: z.ZodNullable<z.ZodString>;
    shareUrl: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type TelegramTip = z.infer<typeof TelegramTipSchema>;
export declare const contract: {
    ping: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        status: z.ZodLiteral<"ok">;
        timestamp: z.ZodISODateTime;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    authHealth: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        status: z.ZodString;
        emailConfigured: z.ZodBoolean;
        smsConfigured: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    createRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        projectSlug: z.ZodString;
        projectId: z.ZodOptional<z.ZodString>;
        projectName: z.ZodOptional<z.ZodString>;
        contact: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodOptional<z.ZodString>;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodOptional<z.ZodString>;
        isPrivate: z.ZodOptional<z.ZodBoolean>;
        legionOnly: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    updateRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        readme: z.ZodOptional<z.ZodString>;
        formats: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    updateRoundSettings: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        isPrivate: z.ZodOptional<z.ZodBoolean>;
        legionOnly: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listRounds: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listProjects: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listMyProjects: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    approveProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    rejectProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    setProjectManagingTeam: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        teamId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    verifyProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    unverifyProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    deleteRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getRoundBySlug: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        slug: z.ZodString;
        number: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    joinRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    leaveRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getMyParticipation: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        joined: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listMyJoinedRounds: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodArray<z.ZodObject<{
        roundId: z.ZodString;
        roundTitle: z.ZodString;
        projectSlug: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        readme: z.ZodString;
        repoUrl: z.ZodNullable<z.ZodString>;
        participantCount: z.ZodNumber;
        myFeedbackCount: z.ZodNumber;
        joinedAt: z.ZodString;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getOwnerSummary: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        openRounds: z.ZodNumber;
        unresolvedFeedback: z.ZodNumber;
        pendingProjects: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getMyLegionAccess: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        hasAccess: z.ZodBoolean;
        linkedNearAccount: z.ZodNullable<z.ZodString>;
        mintUrl: z.ZodString;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    postFeedback: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listFeedback: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        cursor: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        status: z.ZodOptional<z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>>;
        author: z.ZodOptional<z.ZodString>;
        starred: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            roundId: z.ZodString;
            authorAccountId: z.ZodString;
            format: z.ZodEnum<{
                written: "written";
                recorded: "recorded";
            }>;
            body: z.ZodNullable<z.ZodString>;
            url: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                unresolved: "unresolved";
                resolved: "resolved";
                dismissed: "dismissed";
            }>;
            starredAt: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodNullable<z.ZodString>;
            nostrEventId: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        nextCursor: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listMyFeedback: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
        notes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            feedbackId: z.ZodString;
            authorAccountId: z.ZodString;
            role: z.ZodEnum<{
                owner: "owner";
                tester: "tester";
            }>;
            body: z.ZodString;
            createdAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getFeedback: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        feedbackId: z.ZodUUID;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
        notes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            feedbackId: z.ZodString;
            authorAccountId: z.ZodString;
            role: z.ZodEnum<{
                owner: "owner";
                tester: "tester";
            }>;
            body: z.ZodString;
            createdAt: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    addFeedbackNote: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        feedbackId: z.ZodUUID;
        body: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        feedbackId: z.ZodString;
        authorAccountId: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            tester: "tester";
        }>;
        body: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    editFeedback: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        feedbackId: z.ZodUUID;
        body: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    deleteFeedback: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        feedbackId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    setFeedbackStatus: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        feedbackIds: z.ZodArray<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    setFeedbackStarred: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        feedbackIds: z.ZodArray<z.ZodString>;
        starred: z.ZodBoolean;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
            written: "written";
            recorded: "recorded";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            unresolved: "unresolved";
            resolved: "resolved";
            dismissed: "dismissed";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listParticipants: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        accountId: z.ZodString;
        joinedAt: z.ZodString;
        feedbackCount: z.ZodNumber;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    broadcastToRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            custom: "custom";
            round_opened: "round_opened";
            round_closing: "round_closing";
        }>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        recipients: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listNotifications: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        limit: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            roundId: z.ZodString;
            roundTitle: z.ZodString;
            projectSlug: z.ZodString;
            projectRoundNumber: z.ZodNumber;
            feedbackId: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                custom: "custom";
                round_opened: "round_opened";
                round_closing: "round_closing";
                round_closed: "round_closed";
                feedback_resolved: "feedback_resolved";
                feedback_dismissed: "feedback_dismissed";
            }>;
            title: z.ZodString;
            body: z.ZodString;
            readAt: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, z.core.$strip>>;
        unreadCount: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    markNotificationRead: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        roundTitle: z.ZodString;
        projectSlug: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        feedbackId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            custom: "custom";
            round_opened: "round_opened";
            round_closing: "round_closing";
            round_closed: "round_closed";
            feedback_resolved: "feedback_resolved";
            feedback_dismissed: "feedback_dismissed";
        }>;
        title: z.ZodString;
        body: z.ZodString;
        readAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    markAllNotificationsRead: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        updated: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getRoundGithubIssues: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        repoUrl: z.ZodString;
        windowStart: z.ZodString;
        windowEnd: z.ZodNullable<z.ZodString>;
        contributors: z.ZodArray<z.ZodObject<{
            login: z.ZodString;
            issues: z.ZodArray<z.ZodObject<{
                number: z.ZodNumber;
                title: z.ZodString;
                url: z.ZodString;
                createdAt: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getCreditCandidates: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        accountId: z.ZodString;
        writtenCount: z.ZodNumber;
        recordedCount: z.ZodNumber;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    closeRound: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        credits: z.ZodOptional<z.ZodArray<z.ZodObject<{
            builderAccountId: z.ZodString;
            contributedMeaningfully: z.ZodBoolean;
            summary: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        formats: z.ZodArray<z.ZodEnum<{
            issues: "issues";
            written: "written";
            recorded: "recorded";
        }>>;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        status: z.ZodEnum<{
            pending: "pending";
            open: "open";
            closed: "closed";
            rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listRoundCredits: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roundId: z.ZodString;
        builderAccountId: z.ZodString;
        projectSlug: z.ZodString;
        roundTitle: z.ZodString;
        contributedMeaningfully: z.ZodBoolean;
        summary: z.ZodNullable<z.ZodString>;
        writtenCount: z.ZodNumber;
        recordedCount: z.ZodNumber;
        createdAt: z.ZodString;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getBuilderRounds: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        accountId: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        roundId: z.ZodString;
        roundTitle: z.ZodString;
        projectSlug: z.ZodString;
        repoUrl: z.ZodNullable<z.ZodString>;
        issuesUrl: z.ZodNullable<z.ZodString>;
        contributedMeaningfully: z.ZodBoolean;
        summary: z.ZodNullable<z.ZodString>;
        writtenCount: z.ZodNumber;
        recordedCount: z.ZodNumber;
        closedAt: z.ZodString;
        creditedAt: z.ZodString;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getRoundEndorsements: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        roundIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodRecord<z.ZodString, z.ZodObject<{
        eventId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getBuilderActivity: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        accountId: z.ZodString;
        limit: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        sourceDisplayName: z.ZodString;
        type: z.ZodString;
        timestamp: z.ZodString;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    searchProjects: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        query: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        available: z.ZodBoolean;
        results: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            slug: z.ZodString;
            title: z.ZodString;
            description: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
            status: z.ZodEnum<{
                active: "active";
                paused: "paused";
                archived: "archived";
            }>;
            visibility: z.ZodEnum<{
                private: "private";
                unlisted: "unlisted";
                public: "public";
            }>;
            domain: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
            repository: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
            logoUrl: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getTelegramTip: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        accountId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        handle: z.ZodNullable<z.ZodString>;
        source: z.ZodNullable<z.ZodEnum<{
            nearbuilders: "nearbuilders";
            "near-social": "near-social";
        }>>;
        available: z.ZodBoolean;
        message: z.ZodNullable<z.ZodString>;
        shareUrl: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getProjectSearchStatus: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        enabled: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    listPublicProjects: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getProjectBySlug: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        slug: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            rejected: "rejected";
            approved: "approved";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            repository: z.ZodNullable<z.ZodString>;
            logoUrl: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
                scope: "scope";
                result: "result";
            }>;
        }, z.core.$strip>>;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerAccountId: z.ZodString;
            title: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                open: "open";
                closed: "closed";
                rejected: "rejected";
            }>;
            projectRoundNumber: z.ZodNumber;
        }, z.core.$strip>>;
        canManage: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    inviteTesters: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        fromRoundId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        recipients: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getBuilderStanding: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        accountId: z.ZodString;
    }, z.core.$strip>, z.ZodNullable<z.ZodObject<{
        accountId: z.ZodString;
        rank: z.ZodNumber;
        score: z.ZodNumber;
        eventCount: z.ZodNumber;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getLeaderboard: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        period: z.ZodDefault<z.ZodEnum<{
            weekly: "weekly";
            monthly: "monthly";
            "all-time": "all-time";
        }>>;
        limit: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        period: z.ZodEnum<{
            weekly: "weekly";
            monthly: "monthly";
            "all-time": "all-time";
        }>;
        configured: z.ZodBoolean;
        available: z.ZodBoolean;
        data: z.ZodArray<z.ZodObject<{
            rank: z.ZodNumber;
            actor: z.ZodString;
            score: z.ZodNumber;
            eventCount: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    listFailedActivityEvents: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        operation: z.ZodEnum<{
            emit: "emit";
            retract: "retract";
        }>;
        eventType: z.ZodNullable<z.ZodString>;
        actor: z.ZodNullable<z.ZodString>;
        payload: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        targetEventId: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
        idempotencyKey: z.ZodString;
        subjectKind: z.ZodNullable<z.ZodString>;
        subjectId: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            pending: "pending";
            sent: "sent";
            failed: "failed";
            cancelled: "cancelled";
        }>;
        attempts: z.ZodNumber;
        lastError: z.ZodNullable<z.ZodString>;
        nextAttemptAt: z.ZodISODateTime;
        eventId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodISODateTime;
        sentAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    retryFailedActivityEvents: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        ids: z.ZodArray<z.ZodUUID>;
    }, z.core.$strip>, z.ZodObject<{
        retried: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getActivityOutboxDepth: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        byStatus: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    testError: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        kind: z.ZodEnum<{
            unauthorized: "unauthorized";
            forbidden: "forbidden";
            not_found: "not_found";
            conflict: "conflict";
            bad_request: "bad_request";
            internal: "internal";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        ok: z.ZodLiteral<true>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
};
export type ContractType = typeof contract;
