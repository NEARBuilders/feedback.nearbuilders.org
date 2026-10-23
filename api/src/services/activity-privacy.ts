/**
 * Activity serves every event's idempotency key and payload publicly, so an event about a
 * private round (#101) never names one of its feedback ids or carries a credit summary.
 * Emitters and the outbox both send private-round events through {@link redactPrivateEvent}.
 */

const PRIVATE_PAYLOAD_FIELDS = ["feedbackId", "summary"] as const;

/** A stable stand-in for `id`, so retries keep the same key without revealing the id. */
export async function opaqueId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** `key` with every occurrence of `subjectId` replaced by its {@link opaqueId}. */
export async function privateKey(key: string, subjectId: string): Promise<string> {
  return key.replaceAll(subjectId, await opaqueId(subjectId));
}

/**
 * Both forms a key may have been queued under. A round can switch between public and
 * private, so lookups for cancelling or retracting an event try each.
 */
export async function keyForms(key: string, subjectId: string): Promise<string[]> {
  return [key, await privateKey(key, subjectId)];
}

export async function redactPrivateEvent<
  T extends { idempotencyKey: string; payload: Record<string, unknown> },
>(event: T, subjectId?: string): Promise<T> {
  const payload = { ...event.payload };
  for (const field of PRIVATE_PAYLOAD_FIELDS) delete payload[field];
  return {
    ...event,
    idempotencyKey: subjectId
      ? await privateKey(event.idempotencyKey, subjectId)
      : event.idempotencyKey,
    payload,
  };
}
