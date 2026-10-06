import { adminContext, getPluginClient, nearAuthedContext } from "./setup";

type Format = "written" | "recorded" | "issues";

interface RoundInput {
  projectSlug?: string;
  title?: string;
  description?: string;
  readme?: string;
  formats?: Format[];
  repoUrl?: string;
}

let slugCounter = 0;

export function freshSlug(prefix = "fixture") {
  return `${prefix}-${process.pid}-${++slugCounter}`;
}

export async function clientFor(accountId: string) {
  return getPluginClient(nearAuthedContext(accountId));
}

export async function createOpenRound(owner: string, input: RoundInput = {}) {
  const ownerClient = await clientFor(owner);
  const round = await ownerClient.createRound({
    projectSlug: input.projectSlug ?? freshSlug(),
    title: input.title ?? "Try the new onboarding flow",
    description: input.description ?? "Walk through signup and tell us where you got stuck.",
    readme: input.readme,
    formats: input.formats ?? ["written"],
    repoUrl: input.repoUrl,
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { round: await ownerClient.getRound({ id: round.id }), ownerClient };
}

export async function joinWithFeedback(roundId: string, tester: string, bodies: string[] = []) {
  const client = await clientFor(tester);
  await client.joinRound({ id: roundId });
  const feedback = [];
  for (const body of bodies) {
    feedback.push(await client.postFeedback({ id: roundId, format: "written", body }));
  }
  return { client, feedback };
}
