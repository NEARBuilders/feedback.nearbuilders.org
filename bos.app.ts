import { App } from "everything-dev/descriptor";

// Authored app descriptor. The published config is canonicalized to JSON
// from this file; dev-only overrides live in bos.dev.ts (never published).
export default App({
  name: "feedback.nearbuilders.org",
  // The base runtime this app extends — inherit the platform, override only what you change.
  extends: "bos://dev.everything.near/everything.dev",
  // The NEAR account this app publishes under.
  account: "nearbuilding.near",
  // The gateway: FastKV lookup key and public ingress for this runtime.
  domain: "feedback.nearbuilders.org",
  // Human-readable runtime title (surfaced by the UI).
  title: "Feedback | NearBuilders",
  // Human-readable runtime description.
  description:
    "Request a feedback round, get matched with builders, and turn testing into portable credit.",
  // GitHub repository tarball source used by `bos init`/`bos sync` templates.
  repository: "https://github.com/NEARBuilders/feedback.nearbuilders.org",
  // Platform release pin (ADR 0034): fail loudly when the resolved parent
  // platform doesn't match, instead of silently floating.
  platform: "2.0.0-rc.18",
  // CI settings: runtime image name, Railway service.
  ci: {
    railway: {
      service: "feedback-app",
    },
  },
  // Local API workspace override.
  api: {
    path: "api",
    secrets: [
      "API_DATABASE_URL",
      "PROJECTS_API_BASE_URL",
      "ACTIVITY_API_BASE_URL",
      "ACTIVITY_API_KEY",
      "ACTIVITY_SOURCE_ID",
      "NOSTR_SECRET_KEY_HEX",
      "GITHUB_API_TOKEN",
      "TIP_MESSAGE_TEMPLATE",
    ],
  },
  // Local UI workspace override.
  ui: {
    path: "ui",
  },
  // Attached plugins, keyed by registry key. `path` = local workspace, `extends` = published module.
  plugins: {
    legion: {
      path: "plugins/legion",
      name: "legion",
      variables: {
        nodeUrl: "https://free.rpc.fastnear.com",
        contractIds: ["initiate.nearlegion.near", "ascendant.nearlegion.near"],
      },
    },
    storage: {
      path: "plugins/storage",
      name: "storage",
      variables: {
        allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
        maxUploadBytes: 5242880,
      },
      secrets: [
        "STORAGE_DATABASE_URL",
        "STORAGE_ENDPOINT",
        "STORAGE_BUCKET",
        "STORAGE_REGION",
        "STORAGE_PUBLIC_URL",
        "STORAGE_ACCESS_KEY_ID",
        "STORAGE_SECRET_ACCESS_KEY",
      ],
    },
  },
});
