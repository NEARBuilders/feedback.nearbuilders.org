/**
 * True when `projectId` contradicts the registry's id for the slug. An unknown slug (null:
 * not found, or registry unreachable/unconfigured) never contradicts, so it cannot block.
 */
export const projectIdMismatchesRegistry = (
  registered: { id: string } | null,
  projectId: string | null | undefined,
): boolean => Boolean(projectId && registered && registered.id !== projectId);
