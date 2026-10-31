import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  projects: [{ name: "sample-scope", testMatch: "sample-scope.spec.ts" }],
  webServer: undefined,
});
