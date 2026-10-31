import { defineConfig } from "@playwright/test";
import base from "./playwright.trust.config";

// Run the UI-5 workflow checks against an already running Compose deployment.
// Authoring is covered in the disposable development run; preserve the sample's
// Scenario inventory in the owner's persistent deployment.
export default defineConfig({
  ...base,
  projects: [{ name: "ui-5-docker", testMatch: "trust.spec.ts" }],
  grepInvert: /control authoring proposes YAML/,
  webServer: undefined,
});
