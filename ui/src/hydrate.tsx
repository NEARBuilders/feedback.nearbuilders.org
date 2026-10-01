/**
 * Client bootstrap — creates browser-side QueryClient, Router, and auth/API clients.
 * Called from the host-rendered HTML shell.
 *
 * BE CAREFUL MODIFYING THIS FILE — changes will be overwritten by `bos sync` / `bos upgrade`.
 * Prefer upstream changes at https://github.com/nearbuilders/everything-dev
 */

import { createApiClient, createAuthClient, getCspNonce, getRuntimeConfig } from "./app";
import { loadFederatedComponents } from "./lib/load-federated-components";
import "./styles.css";

const COMPONENTS_REMOTE_URL = import.meta.env.DEV
  ? import.meta.env.COMPONENTS_REMOTE_DEV_URL
  : import.meta.env.COMPONENTS_REMOTE_PRODUCTION_URL;

declare global {
  interface Window {
    __EVERYTHING_DEV_HYDRATE_PROMISE__?: Promise<void>;
    __EVERYTHING_DEV_SSR__?: boolean;
  }
}

function isServerRendered(): boolean {
  if (window.__EVERYTHING_DEV_SSR__ !== undefined) {
    return window.__EVERYTHING_DEV_SSR__;
  }
  return (window as any).$_TSR !== undefined;
}

export async function hydrate() {
  if (window.__EVERYTHING_DEV_HYDRATE_PROMISE__) {
    return window.__EVERYTHING_DEV_HYDRATE_PROMISE__;
  }

  const hydratePromise = (async () => {
    console.log("[Hydrate] Starting...");

    // Resolved before the first render (#56), so federated() proxies in the components barrel
    // read a settled registry — no Suspense, no flash from local to remote after paint.
    await loadFederatedComponents(COMPONENTS_REMOTE_URL, 15000);

    const runtimeConfig = getRuntimeConfig();
    const cspNonce = getCspNonce();

    const { QueryClientProvider } = await import("@tanstack/react-query");
    const { createRouter } = await import("./router");
    const client = new (await import("@tanstack/react-query")).QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 30 * 60 * 1000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });

    if (!runtimeConfig.hostUrl || !runtimeConfig.rpcBase) {
      throw new Error("Missing hostUrl or rpcBase in runtime config");
    }

    const { router } = createRouter({
      context: {
        queryClient: client,
        runtimeConfig,
        cspNonce,
        apiClient: createApiClient({
          hostUrl: runtimeConfig.hostUrl,
          rpcBase: runtimeConfig.rpcBase,
        }),
        authClient: createAuthClient({ runtimeConfig, cspNonce }),
      },
    });

    if (isServerRendered()) {
      const { hydrateRoot } = await import("react-dom/client");
      const { RouterClient } = await import("@tanstack/react-router/ssr/client");

      console.log("[Hydrate] Calling hydrateRoot...");
      hydrateRoot(
        document,
        <QueryClientProvider client={client}>
          <RouterClient router={router} />
        </QueryClientProvider>,
      );
    } else {
      const { createRoot } = await import("react-dom/client");
      const { RouterProvider } = await import("@tanstack/react-router");

      console.log("[Hydrate] Calling createRoot...");
      createRoot(document).render(
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
    }

    console.log("[Hydrate] Complete!");
  })().catch((error) => {
    console.error("[Hydrate] Failed:", error);
    window.__EVERYTHING_DEV_HYDRATE_PROMISE__ = undefined;
    throw error;
  });

  window.__EVERYTHING_DEV_HYDRATE_PROMISE__ = hydratePromise;
  return hydratePromise;
}

export default hydrate;
