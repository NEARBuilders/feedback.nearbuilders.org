import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { implement } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { contract, PublicProjectStatusSchema } from "@/contract";

const os = implement({
  getProjectStatus: contract.getProjectStatus,
  getProjectSearchStatus: contract.getProjectSearchStatus,
});

const handler = new OpenAPIHandler(
  os.router({
    getProjectStatus: os.getProjectStatus.handler(() => ({
      status: "pending" as const,
      openRounds: 0,
    })),
    getProjectSearchStatus: os.getProjectSearchStatus.handler(() => ({ enabled: true })),
  }),
);

async function get(path: string) {
  const { response } = await handler.handle(new Request(`http://test${path}`));
  return response;
}

describe("GET /projects/{slug}/status (#239)", () => {
  it("answers with only the status and open round count", async () => {
    const response = await get("/projects/kelytra/status");
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ status: "pending", openRounds: 0 });
  });

  it("does not shadow the static project search status route", async () => {
    const response = await get("/projects/search/status");
    expect(await response?.json()).toEqual({ enabled: true });
  });

  it("only allows the three project statuses and a non-negative count", () => {
    expect(PublicProjectStatusSchema.safeParse({ status: "open", openRounds: 0 }).success).toBe(
      false,
    );
    expect(
      PublicProjectStatusSchema.safeParse({ status: "approved", openRounds: -1 }).success,
    ).toBe(false);
  });
});
