import { ORPCError } from "@orpc/client";
import { notFound } from "@tanstack/react-router";

export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") throw notFound();
    throw error;
  }
}
