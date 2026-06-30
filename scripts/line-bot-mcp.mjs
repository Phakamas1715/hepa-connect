#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = resolve(projectRoot, ".env");

function readEnvFile() {
  if (!existsSync(envFile)) return {};

  return Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .map((line) => line.replace(/^\uFEFF/, "").trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
}

const fileEnv = readEnvFile();
const value = (key) => process.env[key] || fileEnv[key] || "";
const enabled = value("LINE_MCP_ENABLED") === "true";
const token = value("LINE_CHANNEL_ACCESS_TOKEN");
const testRecipient = value("LINE_TEST_RECIPIENT_ID");

if (!enabled) {
  console.error("LINE MCP is disabled. Set LINE_MCP_ENABLED=true only for controlled testing.");
  process.exit(1);
}

if (!token || !testRecipient) {
  console.error("LINE MCP requires LINE_CHANNEL_ACCESS_TOKEN and LINE_TEST_RECIPIENT_ID.");
  process.exit(1);
}

const child = spawn("line-bot-mcp-server", [], {
  cwd: projectRoot,
  env: {
    ...process.env,
    CHANNEL_ACCESS_TOKEN: token,
    DESTINATION_USER_ID: testRecipient,
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start LINE Bot MCP Server: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
