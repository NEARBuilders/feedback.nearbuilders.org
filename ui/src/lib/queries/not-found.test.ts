import { ORPCError } from "@orpc/client";
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { orNotFound } from "./not-found";

describe("orNotFound", () => {
  it("passes resolved data through", async () => {
    await expect(orNotFound(Promise.resolve({ id: "r1" }))).resolves.toEqual({ id: "r1" });
  });

  it("turns an API NOT_FOUND into a router notFound", async () => {
    const error = await orNotFound(Promise.reject(new ORPCError("NOT_FOUND"))).catch((e) => e);
    expect(isNotFound(error)).toBe(true);
  });

  it("rethrows any other error for the error boundary", async () => {
    const failure = new ORPCError("INTERNAL_SERVER_ERROR");
    await expect(orNotFound(Promise.reject(failure))).rejects.toBe(failure);
  });
});
