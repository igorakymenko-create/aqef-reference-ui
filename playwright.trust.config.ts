import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  projects: [{ name: "ui-5", testMatch: "trust.spec.ts" }],
});
