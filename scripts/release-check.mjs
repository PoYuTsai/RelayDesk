import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  ".dockerignore",
  "Dockerfile",
  "README.md",
  "README.zh-TW.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docker-compose.yml",
  "docs/docker.md",
  "docs/getting-started.md",
  "docs/configuration.md",
  "docs/compatibility.md",
  "docs/release-checklist.md",
  "docs/slash-commands.md",
  "relay.config.example.json"
];

const forbiddenTracked = ["relay.local.json", ".env", ".relaydesk/sessions.json"];
const requiredGitignoreEntries = ["relay.local.json", ".relaydesk/", "*.log", ".env"];

function fail(message) {
  console.error(`Release check failed: ${message}`);
  process.exitCode = 1;
}

function gitOutput(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

for (const file of requiredFiles) {
  if (!existsSync(file)) fail(`missing required file: ${file}`);
}

const trackedFiles = new Set(gitOutput(["ls-files"]).split(/\r?\n/).filter(Boolean));
for (const file of forbiddenTracked) {
  if (trackedFiles.has(file)) fail(`private file is tracked: ${file}`);
}

const gitignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
for (const entry of requiredGitignoreEntries) {
  if (!gitignore.includes(entry)) fail(`.gitignore missing ${entry}`);
}

const exampleConfig = JSON.parse(readFileSync("relay.config.example.json", "utf8"));
const serializedExample = JSON.stringify(exampleConfig);
if (!serializedExample.includes("My App")) fail("example config should remain generic");
if (/C:\\Users\\|\/Users\/|\/home\//i.test(serializedExample)) fail("example config contains a real-looking user path");
if (/@gmail\.com|@outlook\.com|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{24,}/i.test(serializedExample)) {
  fail("example config contains credential-like material");
}

execFileSync("node", ["scripts/public-scan.mjs"], { stdio: "inherit" });

if (process.exitCode) process.exit(process.exitCode);
console.log("Release check passed.");
