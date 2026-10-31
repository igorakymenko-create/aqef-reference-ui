import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

export default defineConfig(({ command }) => {
  // Dev credential stays in this Node process; VITE_* variables are never used.
  const envFile = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  const token =
    process.env.AQEF_ADMIN_TOKEN ??
    envFile.match(/^AQEF_ADMIN_TOKEN=([A-Za-z0-9._-]+)\s*$/m)?.[1];
  if (command === "serve" && (!token || !/^[A-Za-z0-9._-]+$/.test(token)))
    throw new Error("Set AQEF_ADMIN_TOKEN in .env or the server environment");
  return {
    plugins: [
      react(),
      {
        name: "local-provider-map",
        configureServer(server) {
          server.middlewares.use("/providers.json", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(readFileSync("config/providers.json", "utf8"));
          });
          server.middlewares.use("/person.json", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(readFileSync("config/person.json", "utf8"));
          });
        },
      },
    ],
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        "/workspace": {
          target: "http://127.0.0.1:9200",
          rewrite: (p) => p.replace(/^\/workspace/, ""),
        },
        "/api": {
          target: "http://127.0.0.1:8000",
          rewrite: (p) => p.replace(/^\/api/, ""),
          configure(proxy) {
            proxy.on("proxyReq", (req) =>
              req.setHeader(
                "Authorization",
                `Bearer ${createHash("sha256")
                  .update(token + ":aqef-reference-ui-person-v1")
                  .digest("hex")}`,
              ),
            );
          },
        },
        "/sim-control": {
          target: "http://127.0.0.1:9101",
          rewrite: (p) => p.replace(/^\/sim-control/, ""),
        },
        "/sim": {
          target: "http://127.0.0.1:9100",
          rewrite: (p) => p.replace(/^\/sim/, ""),
        },
      },
    },
  };
});
