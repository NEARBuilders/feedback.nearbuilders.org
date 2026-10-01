import type * as React from "react";

export type FederatedComponentsModule = Record<string, unknown>;

let registry: FederatedComponentsModule = {};

export function setFederatedComponentsRegistry(mod: FederatedComponentsModule): void {
  registry = mod;
}

export function getFederatedExport<T>(name: string): T | undefined {
  return registry[name] as T | undefined;
}

/**
 * Wraps a local primitive so it renders the federated nearbuilders.org version once the
 * components remote has resolved (#56), falling back to the local one otherwise — a missing
 * remote, a name the remote doesn't export yet (nearbuilders.org#259 isn't done), a timed-out
 * or unreachable fetch, or plain local development with no remote configured. The registry is
 * populated synchronously before first render (hydrate.tsx awaits it), so this never needs
 * Suspense and never causes a hydration mismatch — it reads a plain object at render time.
 */
export function federated<P extends object>(
  name: string,
  Local: React.ComponentType<P>,
): React.ComponentType<P> {
  function FederatedComponent(props: P) {
    const Remote = getFederatedExport<React.ComponentType<P>>(name);
    const Resolved = Remote ?? Local;
    return <Resolved {...props} />;
  }
  FederatedComponent.displayName = `Federated(${name})`;
  return FederatedComponent;
}
