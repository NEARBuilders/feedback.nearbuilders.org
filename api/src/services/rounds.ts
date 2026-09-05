import { eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { type roundStatus, rounds as roundsTable } from "../db/schema";

export type RoundStatus = (typeof roundStatus)["enumValues"][number];
export type RoundFormat = "issues" | "written" | "recorded";

export interface RoundRecord {
  id: string;
  ownerAccountId: string;
  projectSlug: string;
  title: string;
  description: string;
  formats: RoundFormat[];
  repoUrl: string | null;
  status: RoundStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface CreateRoundInput {
  ownerAccountId: string;
  projectSlug: string;
  title: string;
  description: string;
  formats: RoundFormat[];
  repoUrl?: string | null;
}

export interface RoundsService {
  createRound(input: CreateRoundInput): Promise<RoundRecord>;
  resolveRoundById(id: string): Promise<RoundRecord | null>;
}

export class RoundsTag extends Context.Tag("api/Rounds")<RoundsService, RoundsService>() {}

type RoundRow = typeof roundsTable.$inferSelect;

function toRoundRecord(row: RoundRow): RoundRecord {
  return {
    id: row.id,
    ownerAccountId: row.ownerAccountId,
    projectSlug: row.projectSlug,
    title: row.title,
    description: row.description,
    formats: row.formats as RoundFormat[],
    repoUrl: row.repoUrl,
    status: row.status,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    closedAt: row.closedAt instanceof Date ? row.closedAt.toISOString() : null,
  };
}

function toOrpcError(error: unknown): ORPCError<string, unknown> {
  return error instanceof ORPCError
    ? error
    : new ORPCError("INTERNAL_SERVER_ERROR", {
        message: error instanceof Error ? error.message : String(error),
      });
}

export const RoundsLive = Layer.effect(
  RoundsTag,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    const service: RoundsService = {
      createRound: async (input) => {
        try {
          const [row] = await db
            .insert(roundsTable)
            .values({
              ownerAccountId: input.ownerAccountId,
              projectSlug: input.projectSlug,
              title: input.title,
              description: input.description,
              formats: input.formats,
              repoUrl: input.repoUrl ?? null,
            })
            .returning();

          if (!row) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create round" });
          }

          return toRoundRecord(row);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      resolveRoundById: async (id) => {
        try {
          const [row] = await db.select().from(roundsTable).where(eq(roundsTable.id, id)).limit(1);
          return row ? toRoundRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },
    };

    return service;
  }),
);
