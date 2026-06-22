import { readFileSync } from "node:fs";

const presetPath = "agent-presets.json";
const presets = JSON.parse(readFileSync(presetPath, "utf8"));
const failures = [];

function fail(message) {
  failures.push(message);
}

function requireString(path, value) {
  if (typeof value !== "string" || !value.trim()) fail(`${path} must be a non-empty string`);
}

function requireSemver(path, value) {
  requireString(path, value);
  if (typeof value === "string" && !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(value)) {
    fail(`${path} must look like a semver version`);
  }
}

function read(path) {
  return readFileSync(path, "utf8");
}

const claude = presets?.claude?.ultraCode;
const codex = presets?.codex?.gpt55;

if (presets?.schemaVersion !== 1) fail("schemaVersion must be 1");
if (!claude) fail("missing claude.ultraCode preset");
if (!codex) fail("missing codex.gpt55 preset");

if (claude) {
  requireString("claude.ultraCode.label", claude.label);
  requireString("claude.ultraCode.model", claude.model);
  requireString("claude.ultraCode.effort", claude.effort);
  requireString("claude.ultraCode.fallbackEffort", claude.fallbackEffort);
  requireString("claude.ultraCode.command", claude.command);
  requireSemver("claude.ultraCode.minimumVersion", claude.minimumVersion);
  if (!claude.command.includes(`--model ${claude.model}`)) fail("claude command must include its model");
  if (!claude.command.includes(`--effort ${claude.effort}`)) fail("claude command must include its effort");
}

if (codex) {
  requireString("codex.gpt55.label", codex.label);
  requireString("codex.gpt55.model", codex.model);
  requireString("codex.gpt55.reasoningEffort", codex.reasoningEffort);
  requireSemver("codex.gpt55.minimumVersion", codex.minimumVersion);
  requireString("codex.gpt55.desktopConfigKey", codex.desktopConfigKey);
  requireString("codex.gpt55.requiredExecFlag", codex.requiredExecFlag);
}

const example = JSON.stringify(JSON.parse(read("relay.config.example.json")));
if (claude && !example.includes(claude.command)) fail("relay.config.example.json must use the Claude preset command");

const server = read("server/relay-server.mjs");
const app = read("src/App.tsx");
if (!server.includes("agent-presets.json")) fail("server must load agent-presets.json");
if (!app.includes("../agent-presets.json")) fail("frontend must import agent-presets.json");

const codeFiles = [
  ["server/relay-server.mjs", server],
  ["src/App.tsx", app]
];
const literalsThatMustStayInPreset = [
  claude?.command,
  claude?.label,
  claude?.minimumVersion,
  codex?.minimumVersion
].filter(Boolean);

for (const [file, content] of codeFiles) {
  for (const literal of literalsThatMustStayInPreset) {
    if (content.includes(`"${literal}"`) || content.includes(`'${literal}'`) || content.includes(`\`${literal}\``)) {
      fail(`${file} hardcodes preset literal "${literal}"`);
    }
  }
}

const docsToCheck = ["README.md", "docs/compatibility.md", "docs/configuration.md", "docs/getting-started.md"];
for (const doc of docsToCheck) {
  const content = read(doc);
  if (claude && !content.includes(claude.label)) fail(`${doc} should mention ${claude.label}`);
  if (codex && !content.includes(codex.model)) fail(`${doc} should mention ${codex.model}`);
}

if (failures.length) {
  console.error("Agent preset check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Agent preset check passed.");
