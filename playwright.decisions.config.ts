import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  projects: [{ name: "ui-6", testMatch: "decisions.spec.ts" }],
});
