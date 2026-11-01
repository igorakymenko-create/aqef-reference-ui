import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  // This owner-deployment migration includes several full-workspace preflights
  // and a real run over retained history, like the Docker regression workflows.
  timeout: 120000,
  expect: { timeout: 30000 },
  projects: [{ name: "sample-scope", testMatch: "sample-scope.spec.ts" }],
  webServer: undefined,
});
