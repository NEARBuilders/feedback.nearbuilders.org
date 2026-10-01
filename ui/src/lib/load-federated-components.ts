import { createInstance, getInstance } from "@module-federation/enhanced/runtime";
import { setGlobalFederationInstance } from "@module-federation/runtime-core";
import {
  type FederatedComponentsModule,
  setFederatedComponentsRegistry,
} from "./federated-components";

const REMOTE_NAME = "nearbuildersComponents";
const REMOTE_GLOBAL = "ui";

function ensureFederationInstance() {
  let instance = getInstance();
  if (!instance) {
    instance = createInstance({ name: "feedback-host", remotes: [] });
    setGlobalFederationInstance(instance);
  }
  return instance;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function resolveRemoteEntryUrl(entryUrl: string): string {
  if (entryUrl.endsWith("/remoteEntry.js")) return entryUrl;
  if (entryUrl.endsWith("/mf-manifest.json")) {
    return `${entryUrl.replace(/\/mf-manifest\.json$/, "")}/remoteEntry.js`;
  }
  return `${entryUrl.replace(/\/$/, "")}/remoteEntry.js`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function verifyIntegrity(entryUrl: string, expectedIntegrity: string): Promise<boolean> {
  try {
    const response = await fetch(resolveRemoteEntryUrl(entryUrl));
    if (!response.ok) {
      console.warn(`[Federation] Integrity check fetch failed: ${response.status} ${entryUrl}`);
      return false;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-384", bytes);
    const computed = `sha384-${toBase64(new Uint8Array(digest))}`;
    if (computed !== expectedIntegrity) {
      console.warn(
        `[Federation] Components remote integrity mismatch, refusing to load\n` +
          `  Expected: ${expectedIntegrity}\n` +
          `  Computed: ${computed}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      "[Federation] Components remote integrity check failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Registers and loads nearbuilders.org's components remote (#55's remotes.config.json), best
 * effort: a missing entry URL (SSR today — nearbuilders.org#260 isn't done), an unreachable
 * remote, an integrity mismatch, or a timeout all resolve to a no-op, leaving every federated()
 * wrapper on its local fallback. When expectedIntegrity is provided, the remote's entry script
 * is fetched and hashed (Web Crypto — everything-dev/integrity's verifySriForUrl is Node-only)
 * before registerRemotes(); the MF runtime has no integrity option of its own. Isomorphic —
 * the client bundle's embedded MF runtime and the SSR bundle's @module-federation/node runtime
 * plugin both expose the same registerRemotes/loadRemote API, so this one function drives both
 * hydrate.tsx (client) and router.server.tsx (SSR).
 */
export async function loadFederatedComponents(
  entryUrl: string | null | undefined,
  timeoutMs: number,
  expectedIntegrity?: string | null,
): Promise<void> {
  if (!entryUrl) return;

  try {
    if (
      expectedIntegrity &&
      !(await withTimeout(verifyIntegrity(entryUrl, expectedIntegrity), timeoutMs))
    ) {
      return;
    }

    const instance = ensureFederationInstance();
    instance.registerRemotes([{ name: REMOTE_NAME, entry: `${entryUrl}/mf-manifest.json` }]);

    // Both this app's container and nearbuilders.org's are named "ui" (everything-dev requires
    // it), and a global-type remote resolves to whatever window.ui already is — ours. Without
    // this the "remote" is our own barrel, every federated() wrapper finds itself in the
    // registry, and the first render recurses forever. Hide our container while the remote's
    // entry script defines its own, then put ours back.
    const host = globalThis as unknown as Record<string, unknown>;
    const ownContainer = host[REMOTE_GLOBAL];
    host[REMOTE_GLOBAL] = undefined;
    let mod: FederatedComponentsModule | null;
    try {
      mod = await withTimeout(
        instance.loadRemote<FederatedComponentsModule>(`${REMOTE_NAME}/components`),
        timeoutMs,
      );
    } finally {
      if (ownContainer !== undefined) host[REMOTE_GLOBAL] = ownContainer;
    }

    if (mod) setFederatedComponentsRegistry(mod);
  } catch {
    // Local primitives remain the fallback — see federated-components.tsx.
  }
}
