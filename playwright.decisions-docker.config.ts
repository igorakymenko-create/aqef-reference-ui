import { defineConfig } from "@playwright/test";
import base from "./playwright.decisions.config";
export default defineConfig({ ...base, webServer: undefined });
