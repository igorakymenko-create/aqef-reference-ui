import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Check the running Compose deployment, without starting development servers.
export default defineConfig({
  ...base,
  // Persistent history includes earlier runs and control metadata; allow the
  // real engine to finish its paginated reads without clearing that history.
  timeout: 120000,
  expect: { timeout: 30000 },
  projects: [{ name: "docker", testMatch: "docker.spec.ts" }],
  webServer: undefined,
});
