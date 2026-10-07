export interface LinkedAccountsContext {
  near?: {
    primaryAccountId?: string | null;
    linkedAccounts?: Array<{ accountId?: string | null }> | null;
  } | null;
}

/**
 * Every NEAR account linked to the caller's session, primary first. A NEAR account is the only
 * identity feedback data is keyed on (#121), so "is this mine?" checks match against all of
 * them: switching the primary wallet must not strand a user's own history.
 */
export function linkedAccountIds(context: LinkedAccountsContext): string[] {
  const ids: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(context.near?.primaryAccountId);
  for (const account of context.near?.linkedAccounts ?? []) add(account.accountId);
  return ids;
}

/**
 * The account the caller acts as on something they may already have joined: the primary
 * account, unless a different linked account is the one that joined, in which case that one
 * (so posting stays attached to the account that holds the participation).
 */
export function actingAccountId(
  linkedIds: string[],
  participantAccountId: string | null,
): string | null {
  if (participantAccountId && linkedIds.includes(participantAccountId)) {
    return participantAccountId;
  }
  return linkedIds[0] ?? null;
}
