import { describe, expect, it } from "vitest";
import { adminContext, authedContext, getPluginClient } from "../setup";

describe("API Plugin Integration Tests", () => {
  describe("ping", () => {
    it("returns healthy status", async () => {
      const client = await getPluginClient();
      const result = await client.ping();

      expect(result).toEqual({
        status: "ok",
        timestamp: expect.any(String),
      });
    });
  });

  describe("authHealth", () => {
    it("rejects unauthenticated requests", async () => {
      const client = await getPluginClient();
      await expect(client.authHealth()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("returns status when authenticated", async () => {
      const client = await getPluginClient(authedContext());
      const result = await client.authHealth();

      expect(result.status).toBe("ok");
      expect(result.emailConfigured).toEqual(expect.any(Boolean));
      expect(result.smsConfigured).toEqual(expect.any(Boolean));
    });
  });

  describe("testError", () => {
    it("rejects signed-out callers and non-admins before reaching the switch", async () => {
      const anon = await getPluginClient();
      await expect(anon.testError({ kind: "internal" as never })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      const member = await getPluginClient(authedContext());
      await expect(member.testError({ kind: "internal" as never })).rejects.toThrow();
    });

    it("maps error kinds to client-visible failures, for admins only", async () => {
      const client = await getPluginClient(adminContext());

      await expect(client.testError({ kind: "unauthorized" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(client.testError({ kind: "forbidden" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(client.testError({ kind: "not_found" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(client.testError({ kind: "conflict" })).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await expect(client.testError({ kind: "bad_request" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(client.testError({ kind: "internal" as never })).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
    });
  });
});
