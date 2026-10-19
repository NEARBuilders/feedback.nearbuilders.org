import type { Finding } from "./domain";

export const blockerMessages = (findings: readonly Finding[]): string[] =>
  findings.filter((f) => f.severity === "blocker").map((f) => f.message);

export const warnMessages = (findings: readonly Finding[]): string[] =>
  findings.filter((f) => f.severity === "warn").map((f) => f.message);
