import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Check the running Compose deployment, without starting development servers.
export default defineConfig({
  ...base,
  projects: [{ name: "docker", testMatch: "docker.spec.ts" }],
  webServer: undefined,
});
