import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".local/browsers");
const env = {
  ...process.env,
  AQEF_ADMIN_TOKEN: randomBytes(24).toString("hex"),
};
export default defineConfig({
  testDir: "./checks",
  projects: [
    { name: "ui-3", testMatch: "oracles.spec.ts", dependencies: ["ui-2"] },
    { name: "ui-1", testMatch: "explorer.spec.ts" },
    {
      name: "ui-2",
      testMatch: ["workspace.spec.ts", "schema.spec.ts"],
      dependencies: ["ui-1"],
    },
  ],
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "python checks/dev_engine.py",
      url: "http://127.0.0.1:9191",
      env,
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:3000",
      env,
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
