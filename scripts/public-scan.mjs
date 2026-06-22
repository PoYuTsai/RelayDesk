import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const scannedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip"]);

const blockedPatterns = [
  { name: "private Windows user path", pattern: /C:\\Users\\(?!you\b|Public\b)[A-Za-z0-9._-]+/i },
  { name: "private WSL user path", pattern: /\/mnt\/c\/Users\/(?!you\b|Public\b)[A-Za-z0-9._-]+/i },
  { name: "private macOS user path", pattern: /\/Users\/(?!you\b|Shared\b)[A-Za-z0-9._-]+/i },
  { name: "private Linux home path", pattern: /\/home\/(?!you\b|runner\b)[A-Za-z0-9._-]+/i },
  { name: "personal email", pattern: /[A-Z0-9._%+-]+@(gmail|outlook|hotmail|icloud|yahoo)\.com/i },
  { name: "OpenAI secret key", pattern: /sk-(proj|live|test|ant|[A-Za-z0-9]{16,})[A-Za-z0-9_-]*/ },
  { name: "API key assignment", pattern: /\b(OPENAI|ANTHROPIC|CLAUDE|SUPABASE|REVENUECAT)_[A-Z0-9_]*KEY\s*=/ },
  { name: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9._-]{24,}/i }
];

const findings = [];

for (const file of scannedFiles) {
  const lower = file.toLowerCase();
  if ([...binaryExtensions].some((ext) => lower.endsWith(ext))) continue;
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const blocked of blockedPatterns) {
      if (blocked.pattern.test(line)) {
        findings.push(`${file}:${index + 1}: ${blocked.name}`);
      }
    }
  }
}

if (findings.length) {
  console.error("Public scan failed. Remove private paths, credentials, or local-only session names:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Public scan passed (${scannedFiles.length} public files checked).`);
