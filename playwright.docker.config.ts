import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Check the running Compose deployment, without starting development servers.
export default defineConfig({
  ...base,
  testMatch: "docker.spec.ts",
  webServer: undefined,
});
