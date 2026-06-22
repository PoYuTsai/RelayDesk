import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dataRoot = resolve(process.env.RELAYDESK_DATA_DIR || root);
const staticRoot = resolve(process.env.RELAYDESK_STATIC_DIR || join(root, "dist"));
const port = Number(process.env.RELAYDESK_PORT || 8791);
const host = process.env.RELAYDESK_HOST || "127.0.0.1";
const minCodexGpt55Version = "0.141.0";
const minClaudeOpus48Version = "2.1.154";
const claudeUltraModel = "opus";
const claudeUltraEffort = "xhigh";

const defaultConfig = {
  projects: [
    {
      id: "my-app",
      name: "My App",
      path: "C:\\path\\to\\MyApp",
      runners: []
    }
  ]
};

async function loadConfig() {
  const local = localConfigPath();
  const example = join(root, "relay.config.example.json");
  const path = existsSync(local) ? local : existsSync(example) ? example : "";
  if (!path) return defaultConfig;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    return { ...defaultConfig, configError: String(error) };
  }
}

function localConfigPath() {
  return join(dataRoot, "relay.local.json");
}

function editableConfig(config) {
  const next = JSON.parse(JSON.stringify(config || {}));
  delete next.configError;
  if (!Array.isArray(next.projects)) next.projects = [];
  return next;
}

function makeId(value, fallback = "item") {
  return safeSegment(value || fallback).toLowerCase();
}

function ensureUniqueId(items, id, label) {
  if ((items || []).some((item) => item.id === id)) {
    throw new Error(`${label} id already exists: ${id}`);
  }
}

function defaultRunner(project, body) {
  const type = String(body.runnerType || "custom");
  const id = makeId(body.runnerId || type, "runner");
  const session = String(body.session || `${makeId(project.id)}-${id}`).trim();
  const name =
    String(body.name || "").trim() ||
    (type === "claude-code" ? "Claude Code tmux" : type === "codex-cli" ? "Codex CLI tmux" : `${session} tmux`);
  const mode = body.mode === "native" ? "native" : "wsl";
  const cwd = String(body.cwd || project.path || "").trim();
  const startCommand = String(body.startCommand || "").trim();
  return {
    id,
    name,
    kind: "tmux",
    session,
    tmux: {
      mode,
      cwd,
      startCommand,
      ...(type === "codex-cli" || body.dismissCodexUpdatePrompt ? { dismissCodexUpdatePrompt: true } : {})
    }
  };
}

async function writeLocalConfig(config) {
  const next = editableConfig(config);
  await mkdir(dataRoot, { recursive: true });
  await writeFile(localConfigPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

async function editConfig(config, body) {
  const action = String(body.action || "");
  const next = editableConfig(config);

  if (action === "add-project") {
    const name = String(body.name || "").trim();
    const projectPath = String(body.path || "").trim();
    if (!name) throw new Error("Project name is required.");
    if (!projectPath) throw new Error("Project path is required.");
    const id = makeId(body.id || name, "project");
    ensureUniqueId(next.projects, id, "Project");
    next.projects.push({ id, name, path: projectPath, runners: [] });
    return writeLocalConfig(next);
  }

  if (action === "delete-project") {
    const projectId = String(body.projectId || "");
    const before = next.projects.length;
    next.projects = next.projects.filter((project) => project.id !== projectId);
    if (next.projects.length === before) throw new Error(`Project not found: ${projectId}`);
    return writeLocalConfig(next);
  }

  if (action === "add-runner") {
    const project = findProject(next, body.projectId);
    if (!project) throw new Error(`Project not found: ${body.projectId}`);
    if (!Array.isArray(project.runners)) project.runners = [];
    const runner = defaultRunner(project, body);
    if (!runner.session) throw new Error("Runner session is required.");
    if (!runner.tmux.startCommand) throw new Error("Runner startCommand is required.");
    ensureUniqueId(project.runners, runner.id, "Runner");
    if (project.runners.some((item) => item.session === runner.session)) {
      throw new Error(`Runner session already exists: ${runner.session}`);
    }
    project.runners.push(runner);
    return writeLocalConfig(next);
  }

  if (action === "delete-runner") {
    const project = findProject(next, body.projectId);
    if (!project) throw new Error(`Project not found: ${body.projectId}`);
    const before = (project.runners || []).length;
    project.runners = (project.runners || []).filter((runner) => runner.id !== body.runnerId);
    if (project.runners.length === before) throw new Error(`Runner not found: ${body.runnerId}`);
    return writeLocalConfig(next);
  }

  throw new Error(`Unsupported config action: ${action}`);
}

function json(res, status, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(data);
}

function notFound(res) {
  json(res, 404, { error: "not found" });
}

const staticMimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function isInsideDir(file, dir) {
  const boundary = dir.endsWith(sep) ? dir : `${dir}${sep}`;
  return file === dir || file.startsWith(boundary);
}

async function sendStaticFile(req, res, file) {
  const data = await readFile(file);
  res.writeHead(200, {
    "content-type": staticMimeTypes[extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-store"
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

async function serveStatic(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method || "")) return false;
  if (url.pathname.startsWith("/api/")) return false;

  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const requestedFile = resolve(staticRoot, relativePath);
  if (!isInsideDir(requestedFile, staticRoot)) return false;

  try {
    await sendStaticFile(req, res, requestedFile);
    return true;
  } catch {
    if (extname(relativePath)) return false;
    const fallback = resolve(staticRoot, "index.html");
    if (!isInsideDir(fallback, staticRoot)) return false;
    try {
      await sendStaticFile(req, res, fallback);
      return true;
    } catch {
      return false;
    }
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function findProject(config, id) {
  return (config.projects || []).find((project) => project.id === id);
}

function findRunner(project, id) {
  return (project.runners || []).find((runner) => runner.id === id);
}

function configSource() {
  const local = localConfigPath();
  const example = join(root, "relay.config.example.json");
  if (existsSync(local)) return { path: local, kind: "local" };
  if (existsSync(example)) return { path: example, kind: "example" };
  return { path: "", kind: "default" };
}

function safeSegment(value) {
  return String(value || "item")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function evidenceDir(project) {
  return resolve(dataRoot, ".relaydesk", "evidence", safeSegment(project.id));
}

function sessionsFile() {
  return resolve(dataRoot, ".relaydesk", "sessions.json");
}

function emptySessionState(body = {}) {
  return {
    activeStep: String(body.activeStep || "Discuss"),
    task: String(body.task || ""),
    decisions: Array.isArray(body.decisions) ? body.decisions : [],
    evidence: Array.isArray(body.evidence) ? body.evidence : [],
    busEvents: Array.isArray(body.busEvents) ? body.busEvents : [],
    selectedEvidenceId: String(body.selectedEvidenceId || ""),
    writerRunnerId: String(body.writerRunnerId || ""),
    commandRunnerId: String(body.commandRunnerId || ""),
    consoleOutput: String(body.consoleOutput || "")
  };
}

async function readSessionsStore() {
  try {
    const data = JSON.parse(await readFile(sessionsFile(), "utf8"));
    return { sessions: Array.isArray(data.sessions) ? data.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

async function writeSessionsStore(store) {
  const file = sessionsFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ sessions: store.sessions || [] }, null, 2)}\n`, "utf8");
}

function publicSession(session) {
  return {
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    status: session.status || "active",
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    state: emptySessionState(session.state || {})
  };
}

function sessionTitle(body, project) {
  const title = String(body.title || body.state?.task || "").trim();
  if (title) return title.length > 72 ? `${title.slice(0, 69)}...` : title;
  return `${project.name || project.id} session`;
}

async function listSessions(project) {
  const store = await readSessionsStore();
  const sessions = store.sessions
    .filter((session) => session.projectId === project.id)
    .map(publicSession)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return { projectId: project.id, sessions };
}

async function editSession(project, body) {
  const action = String(body.action || "");
  const store = await readSessionsStore();
  const now = new Date().toISOString();

  if (action === "create") {
    const id = `session-${safeSegment(project.id)}-${Date.now()}`;
    const session = {
      id,
      projectId: project.id,
      title: sessionTitle(body, project),
      status: "active",
      createdAt: now,
      updatedAt: now,
      state: emptySessionState(body.state || {})
    };
    store.sessions.unshift(session);
    await writeSessionsStore(store);
    return publicSession(session);
  }

  const session = store.sessions.find((item) => item.projectId === project.id && item.id === body.sessionId);
  if (!session) throw new Error(`Session not found: ${body.sessionId}`);

  if (action === "update") {
    session.title = sessionTitle({ title: body.title || session.title, state: body.state || session.state }, project);
    session.status = body.status === "archived" ? "archived" : "active";
    session.updatedAt = now;
    session.state = emptySessionState(body.state || session.state || {});
    await writeSessionsStore(store);
    return publicSession(session);
  }

  if (action === "archive") {
    session.status = "archived";
    session.updatedAt = now;
    await writeSessionsStore(store);
    return publicSession(session);
  }

  if (action === "restore") {
    session.status = "active";
    session.updatedAt = now;
    await writeSessionsStore(store);
    return publicSession(session);
  }

  if (action === "delete") {
    store.sessions = store.sessions.filter((item) => !(item.projectId === project.id && item.id === body.sessionId));
    await writeSessionsStore(store);
    return publicSession({ ...session, status: "deleted", updatedAt: now });
  }

  throw new Error(`Unsupported session action: ${action}`);
}

async function sendEvidenceFile(res, project, name) {
  const filename = safeSegment(name);
  const dir = evidenceDir(project);
  const file = resolve(dir, filename);
  const boundary = dir.endsWith(sep) ? dir : `${dir}${sep}`;
  if (!file.startsWith(boundary)) return notFound(res);
  try {
    const data = await readFile(file);
    const lower = filename.toLowerCase();
    const mime = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : lower.endsWith(".png") ? "image/png" : "application/octet-stream";
    res.writeHead(200, {
      "content-type": mime,
      "cache-control": "no-store"
    });
    res.end(data);
  } catch {
    notFound(res);
  }
}

const usage = {
  startedAt: new Date().toISOString(),
  totals: {
    starts: 0,
    stops: 0,
    restarts: 0,
    sends: 0,
    captures: 0,
    opens: 0,
    snapshots: 0,
    outputChars: 0,
    evidenceBytes: 0,
    failures: 0
  },
  runners: new Map(),
  actions: []
};

function usageKey(project, runnerId) {
  return `${project.id}:${runnerId || "workspace"}`;
}

function emptyRunnerUsage(project, runnerId, runnerName = "") {
  return {
    key: usageKey(project, runnerId),
    projectId: project.id,
    projectName: project.name,
    runnerId: runnerId || "workspace",
    runnerName: runnerName || runnerId || "Workspace",
    starts: 0,
    stops: 0,
    restarts: 0,
    sends: 0,
    captures: 0,
    opens: 0,
    snapshots: 0,
    outputChars: 0,
    evidenceBytes: 0,
    failures: 0,
    lastAction: "",
    lastAt: ""
  };
}

function usageSnapshot() {
  return {
    startedAt: usage.startedAt,
    totals: usage.totals,
    runners: [...usage.runners.values()].sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt))),
    recentActions: usage.actions.slice(0, 30)
  };
}

function countUsage(project, runner, action, result, extra = {}) {
  const runnerId = runner?.id || extra.runnerId || "workspace";
  const key = usageKey(project, runnerId);
  const row = usage.runners.get(key) || emptyRunnerUsage(project, runnerId, runner?.name);
  const ok = result?.ok !== false;
  const outputChars =
    typeof extra.outputChars === "number"
      ? extra.outputChars
      : String(result?.stdout || "").length + String(result?.stderr || "").length;
  const evidenceBytes = Number(extra.evidenceBytes || 0);
  const at = new Date().toISOString();

  if (ok) {
    if (action === "start") {
      usage.totals.starts += 1;
      row.starts += 1;
    } else if (action === "stop") {
      usage.totals.stops += 1;
      row.stops += 1;
    } else if (action === "restart") {
      usage.totals.restarts += 1;
      row.restarts += 1;
    } else if (action === "send") {
      usage.totals.sends += 1;
      row.sends += 1;
    } else if (action === "capture") {
      usage.totals.captures += 1;
      row.captures += 1;
    } else if (action === "open") {
      usage.totals.opens += 1;
      row.opens += 1;
    } else if (action === "snapshot") {
      usage.totals.snapshots += 1;
      row.snapshots += 1;
    }
    usage.totals.outputChars += outputChars;
    row.outputChars += outputChars;
    usage.totals.evidenceBytes += evidenceBytes;
    row.evidenceBytes += evidenceBytes;
  } else {
    usage.totals.failures += 1;
    row.failures += 1;
  }

  row.lastAction = action;
  row.lastAt = at;
  usage.runners.set(key, row);
  usage.actions.unshift({
    at,
    projectId: project.id,
    projectName: project.name,
    runnerId,
    runnerName: runner?.name || runnerId,
    action,
    ok,
    outputChars,
    evidenceBytes,
    detail: extra.detail || result?.stderr || result?.stdout || ""
  });
  usage.actions.splice(30);
}

function toWslPath(hostPath) {
  const normalized = resolve(hostPath).replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return normalized;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

async function saveEvidence(project, body) {
  const dataUrl = String(body.dataUrl || "");
  const match = dataUrl.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
  if (!match) {
    return { ok: false, code: -1, stdout: "", stderr: "Evidence dataUrl must be a PNG or JPEG data URL." };
  }
  const ext = match[1] === "image/jpeg" ? "jpg" : "png";
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    return { ok: false, code: -1, stdout: "", stderr: "Evidence image is empty." };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runner = safeSegment(body.runnerId || body.source || "runner");
  const dir = evidenceDir(project);
  await mkdir(dir, { recursive: true });
  const filename = `${stamp}-${runner}.${ext}`;
  const hostPath = join(dir, filename);
  await writeFile(hostPath, buffer);
  return {
    ok: true,
    code: 0,
    stdout: hostPath,
    stderr: "",
    evidence: {
      name: filename,
      hostPath,
      wslPath: toWslPath(hostPath),
      bytes: buffer.length,
      mime: match[1]
    }
  };
}

function check(id, label, ok, detail = "", fix = "", level = "fail") {
  return {
    id,
    label,
    status: ok ? "ok" : level,
    detail,
    fix
  };
}

async function commandCheck(id, label, argv, cwd = root, fix = "", level = "fail") {
  const result = await runCommand(argv, cwd, 8000);
  return check(id, label, result.ok, result.stdout || result.stderr, fix, level);
}

async function wslCheck(id, label, script, fix = "", level = "fail") {
  return commandCheck(id, label, ["wsl.exe", "--exec", "bash", "-lc", script], root, fix, level);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function usesWsl(config) {
  return (config.projects || []).some((project) =>
    (project.runners || []).some((runner) => runner.kind === "tmux" && (runner.tmux?.mode || "wsl") === "wsl")
  );
}

function usesNativeTmux(config) {
  return (config.projects || []).some((project) =>
    (project.runners || []).some((runner) => runner.kind === "tmux" && (runner.tmux?.mode || "wsl") === "native")
  );
}

function hasRunnerCommand(config, command) {
  return (config.projects || []).some((project) =>
    (project.runners || []).some((runner) => JSON.stringify(runner).toLowerCase().includes(command.toLowerCase()))
  );
}

function usesPlainWslCodex(config) {
  return (config.projects || []).some((project) =>
    (project.runners || []).some((runner) => {
      if (runner.kind !== "tmux" || (runner.tmux?.mode || "wsl") !== "wsl") return false;
      const command = String(runner.tmux?.startCommand || "");
      return /(^|[\s'"])codex(?=\s|$)/i.test(command);
    })
  );
}

function usesWslClaude(config) {
  return (config.projects || []).some((project) =>
    (project.runners || []).some((runner) => {
      if (runner.kind !== "tmux" || (runner.tmux?.mode || "wsl") !== "wsl") return false;
      return runner.id === "claude-code" || JSON.stringify(runner).toLowerCase().includes("claude");
    })
  );
}

function runnerSessionUniqueness(config) {
  const seen = new Map();
  const duplicates = [];
  for (const project of config.projects || []) {
    for (const runner of project.runners || []) {
      if (!runner.session) continue;
      const key = String(runner.session);
      const label = `${project.name || project.id}/${runner.name || runner.id}`;
      if (seen.has(key)) {
        duplicates.push(`${key}: ${seen.get(key)} + ${label}`);
      } else {
        seen.set(key, label);
      }
    }
  }
  return check(
    "runner-session-unique",
    "Runner session names unique",
    duplicates.length === 0,
    duplicates.length ? duplicates.join("\n") : "Every configured runner uses a distinct tmux session.",
    "Use one unique tmux session name per runner."
  );
}

async function runnerCwdCheck(project, runner) {
  const mode = runner.tmux?.mode || "wsl";
  const cwd = String(runner.tmux?.cwd || project.path || "").trim();
  const id = `runner-cwd-${safeSegment(project.id)}-${safeSegment(runner.id)}`;
  const label = `${project.name} / ${runner.name} cwd`;
  if (!cwd) return check(id, label, false, "No tmux cwd configured.", "Set tmux.cwd to the project path visible inside the runner environment.");
  if (mode === "wsl") {
    return wslCheck(id, label, `test -d ${shellQuote(cwd)} && printf ${shellQuote(cwd)}`, "Set tmux.cwd to a valid WSL path such as /mnt/c/path/to/project.");
  }
  return check(id, label, existsSync(cwd), cwd, "Set tmux.cwd to an existing path for native tmux.");
}

async function tmuxSmokeCheck(id, label, mode, fix = "") {
  const session = `relaydesk-doctor-${process.pid}-${Date.now()}`;
  const base = mode === "native" ? ["tmux"] : ["wsl.exe", "--exec", "tmux"];
  const tmux = (args, timeoutMs = 10000) => runCommand([...base, ...args], root, timeoutMs);
  await tmux(["kill-session", "-t", session], 5000).catch(() => undefined);

  const start = await tmux(["new-session", "-d", "-s", session], 10000);
  if (!start.ok) {
    return check(id, label, false, start.stdout || start.stderr, fix || "Ensure tmux can create detached sessions.");
  }

  const sent = await tmux(["send-keys", "-t", session, "--", "printf relaydesk-doctor-ready", "Enter"], 10000);
  await sleep(250);
  const capture = await tmux(["capture-pane", "-p", "-t", session], 10000);
  await tmux(["kill-session", "-t", session], 5000).catch(() => undefined);

  const output = capture.stdout || capture.stderr || sent.stdout || sent.stderr;
  const ok = sent.ok && capture.ok && output.includes("relaydesk-doctor-ready");
  return check(
    id,
    label,
    ok,
    ok ? `Created, sent to, captured, and killed ${session}.` : output || "No tmux output captured.",
    fix || "Ensure tmux can create, send to, capture, and kill sessions."
  );
}

function firstTomlString(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^\\s*${escaped}\\s*=\\s*["']([^"']+)["']`, "m"));
  return match?.[1] || "";
}

async function readCodexUserConfig() {
  const path = join(homedir(), ".codex", "config.toml");
  try {
    const text = await readFile(path, "utf8");
    return {
      path,
      exists: true,
      model: firstTomlString(text, "model"),
      serviceTier: firstTomlString(text, "service_tier"),
      desktopCliPath: firstTomlString(text, "CODEX_CLI_PATH")
    };
  } catch {
    return { path, exists: false, model: "", serviceTier: "", desktopCliPath: "" };
  }
}

function parseCodexVersion(output) {
  return String(output || "").match(/codex-cli\s+([0-9]+(?:\.[0-9]+){1,2}(?:[-+][^\s]+)?)/i)?.[1] || "";
}

function parseClaudeVersion(output) {
  return String(output || "").match(/([0-9]+(?:\.[0-9]+){1,2})/)?.[1] || "";
}

function semverParts(version) {
  return String(version || "")
    .split(/[+-]/)[0]
    .split(".")
    .map((part) => Number(part || 0))
    .concat([0, 0, 0])
    .slice(0, 3);
}

function semverGte(version, minimum) {
  const current = semverParts(version);
  const target = semverParts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > target[index]) return true;
    if (current[index] < target[index]) return false;
  }
  return true;
}

function normalizeCliPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/\//g, "\\")
    .toLowerCase();
}

function sameCliPath(left, right) {
  return Boolean(left && right && normalizeCliPath(left) === normalizeCliPath(right));
}

function addCandidate(candidates, path, source) {
  const value = String(path || "").trim();
  if (!value) return;
  if (candidates.some((candidate) => sameCliPath(candidate.path, value))) return;
  candidates.push({ path: value, source });
}

async function whereCandidates(command, source) {
  if (process.platform !== "win32") return [];
  const result = await runCommand(["where.exe", command], root, 8000);
  if (!result.ok) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((path) => ({ path, source }));
}

async function testCodexCandidate(candidate) {
  const result = await runCommand([candidate.path, "--version"], root, 10000);
  const output = result.stdout || result.stderr;
  const version = parseCodexVersion(output);
  return {
    ...candidate,
    ok: result.ok && Boolean(version),
    version,
    supportsGpt55: Boolean(version && semverGte(version, minCodexGpt55Version)),
    output,
    error: result.ok ? "" : output
  };
}

async function detectCodexCli() {
  const config = await readCodexUserConfig();
  const candidates = [];
  addCandidate(candidates, process.env.RELAYDESK_CODEX_PATH, "RELAYDESK_CODEX_PATH");
  addCandidate(candidates, config.desktopCliPath, "Codex desktop config");
  for (const candidate of await whereCandidates("codex.cmd", "PATH codex.cmd")) addCandidate(candidates, candidate.path, candidate.source);
  for (const candidate of await whereCandidates("codex.exe", "PATH codex.exe")) addCandidate(candidates, candidate.path, candidate.source);

  if (process.platform !== "win32") {
    addCandidate(candidates, process.env.RELAYDESK_CODEX_PATH || "codex", "PATH codex");
  }

  const tested = [];
  for (const candidate of candidates) tested.push(await testCodexCandidate(candidate));
  const selected = tested.find((candidate) => candidate.ok && candidate.supportsGpt55) || tested.find((candidate) => candidate.ok) || null;
  const pathDefault = tested.find((candidate) => candidate.source.startsWith("PATH") && candidate.ok) || null;
  const help = selected ? await runCommand([selected.path, "exec", "--help"], root, 10000) : null;

  return {
    config,
    candidates: tested,
    selected,
    pathDefault,
    execJson: Boolean(help?.ok && /--json\b/.test(`${help.stdout}\n${help.stderr}`)),
    execHelp: help ? help.stdout || help.stderr : ""
  };
}

function claudeCapability(candidate, helpText, ultraProbe) {
  const supportsEffort = /--effort\b/.test(helpText);
  return {
    ...candidate,
    supportsEffort,
    supportsStreamJson: /stream-json/.test(helpText),
    supportsOpus48: Boolean(candidate.version && semverGte(candidate.version, minClaudeOpus48Version)),
    supportsXhigh: Boolean(ultraProbe?.ok),
    supportsMax: supportsEffort
  };
}

async function testNativeClaudeCandidate(candidate) {
  const result = await runCommand([candidate.path, "--version"], root, 10000);
  const output = result.stdout || result.stderr;
  const version = parseClaudeVersion(output);
  const help = result.ok ? await runCommand([candidate.path, "--help"], root, 10000) : null;
  const helpText = `${help?.stdout || ""}\n${help?.stderr || ""}`;
  const ultraProbe =
    result.ok && version && semverGte(version, minClaudeOpus48Version)
      ? await runCommand([candidate.path, "--model", claudeUltraModel, "--effort", claudeUltraEffort, "--version"], root, 10000)
      : null;
  return claudeCapability(
    {
      ...candidate,
      kind: "native",
      ok: result.ok && Boolean(version),
      version,
      output,
      error: result.ok ? "" : output
    },
    helpText,
    ultraProbe
  );
}

async function testWslClaudeCandidate() {
  const result = await runCommand(["wsl.exe", "--exec", "bash", "-lc", "command -v claude && claude --version"], root, 10000);
  const output = result.stdout || result.stderr;
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const version = parseClaudeVersion(output);
  const help = result.ok ? await runCommand(["wsl.exe", "--exec", "bash", "-lc", "claude --help"], root, 10000) : null;
  const helpText = `${help?.stdout || ""}\n${help?.stderr || ""}`;
  const ultraProbe =
    result.ok && version && semverGte(version, minClaudeOpus48Version)
      ? await runCommand(["wsl.exe", "--exec", "bash", "-lc", `claude --model ${claudeUltraModel} --effort ${claudeUltraEffort} --version`], root, 10000)
      : null;
  return claudeCapability(
    {
      path: lines[0] || "claude",
      source: "WSL claude",
      kind: "wsl",
      ok: result.ok && Boolean(version),
      version,
      output,
      error: result.ok ? "" : output
    },
    helpText,
    ultraProbe
  );
}

async function detectClaudeCli(preferWsl = false) {
  const candidates = [];
  const nativeCandidates = [];
  addCandidate(nativeCandidates, process.env.RELAYDESK_CLAUDE_PATH, "RELAYDESK_CLAUDE_PATH");
  for (const candidate of await whereCandidates("claude.cmd", "PATH claude.cmd")) addCandidate(nativeCandidates, candidate.path, candidate.source);
  if (process.platform !== "win32") addCandidate(nativeCandidates, process.env.RELAYDESK_CLAUDE_PATH || "claude", "PATH claude");

  if (preferWsl && process.platform === "win32") candidates.push(await testWslClaudeCandidate());
  for (const candidate of nativeCandidates) candidates.push(await testNativeClaudeCandidate(candidate));
  if (!preferWsl && process.platform === "win32") candidates.push(await testWslClaudeCandidate());

  const selected =
    (preferWsl ? candidates.find((candidate) => candidate.kind === "wsl" && candidate.ok) : null) ||
    candidates.find((candidate) => candidate.ok && candidate.supportsOpus48 && candidate.supportsXhigh) ||
    candidates.find((candidate) => candidate.ok) ||
    null;
  return {
    candidates,
    selected,
    supportsEffort: Boolean(selected?.supportsEffort),
    supportsStreamJson: Boolean(selected?.supportsStreamJson),
    supportsOpus48: Boolean(selected?.supportsOpus48),
    supportsXhigh: Boolean(selected?.supportsXhigh),
    supportsMax: Boolean(selected?.supportsMax),
    preferredModel: claudeUltraModel,
    preferredEffort: claudeUltraEffort,
    minimumOpus48Version: minClaudeOpus48Version,
    help: ""
  };
}

function cliDetail(candidate) {
  if (!candidate) return "No CLI candidate found.";
  return `${candidate.version || "unknown version"} via ${candidate.source}\n${candidate.path}`;
}

async function agentParityChecks(config) {
  const checks = [];
  const prefersWslClaude = usesWslClaude(config);
  const [codex, claude] = await Promise.all([detectCodexCli(), detectClaudeCli(prefersWslClaude)]);
  const needsCodex = hasRunnerCommand(config, "codex");
  const needsClaude = hasRunnerCommand(config, "claude") || prefersWslClaude;

  checks.push(
    check(
      "claude-selected-cli",
      prefersWslClaude ? "Claude runner CLI" : "Claude selected CLI",
      Boolean(claude.selected),
      cliDetail(claude.selected),
      "Install Claude Code, login, or set RELAYDESK_CLAUDE_PATH.",
      needsClaude ? "fail" : "warn"
    )
  );
  if (claude.selected) {
    checks.push(
      check(
        "claude-stream-json",
        "Claude stream-json support",
        claude.supportsStreamJson,
        claude.supportsStreamJson ? "Claude Code can emit stream-json events for RelayDesk." : "Selected Claude CLI help did not expose stream-json.",
        "Upgrade Claude Code if stream-json is missing.",
        "warn"
      )
    );
    checks.push(
      check(
        "claude-effort-mode",
        "Claude effort flag",
        claude.supportsEffort,
        claude.supportsEffort ? "Claude Code exposes --effort for high-reasoning presets." : "Selected Claude CLI help did not expose --effort.",
        "Upgrade Claude Code if you need Opus 4.8 Ultra Code parity.",
        "warn"
      )
    );
    checks.push(
      check(
        "claude-opus-48",
        "Claude Opus 4.8 capable",
        claude.supportsOpus48,
        `${claude.selected.version || "unknown"} selected; Claude Code ${minClaudeOpus48Version}+ is required for Opus 4.8.`,
        "Upgrade the Claude Code binary used by the tmux runner.",
        "warn"
      )
    );
    checks.push(
      check(
        "claude-ultra-code",
        "Claude Opus 4.8 Ultra Code",
        claude.supportsOpus48 && claude.supportsXhigh,
        claude.supportsXhigh
          ? `Runner accepts --model ${claudeUltraModel} --effort ${claudeUltraEffort}.`
          : `Runner did not accept --model ${claudeUltraModel} --effort ${claudeUltraEffort}. Use --effort max as fallback if this CLI only exposes low/medium/high/max.`,
        "Use Claude Code 2.1.154+ in the same environment as tmux, then start with --model opus --effort xhigh.",
        "warn"
      )
    );
  }

  checks.push(
    check(
      "codex-selected-cli",
      "Codex selected CLI",
      Boolean(codex.selected),
      cliDetail(codex.selected),
      "Install/upgrade Codex CLI or point RELAYDESK_CODEX_PATH at the Codex Desktop bundled binary.",
      needsCodex ? "fail" : "warn"
    )
  );
  if (codex.selected) {
    checks.push(
      check(
        "codex-gpt-55",
        "Codex gpt-5.5 capable",
        codex.selected.supportsGpt55,
        `${codex.selected.version || "unknown"} selected; known minimum for this workflow is ${minCodexGpt55Version}.`,
        "Upgrade Codex CLI, or use the Codex Desktop bundled binary recorded in ~/.codex/config.toml.",
        "warn"
      )
    );
    checks.push(
      check(
        "codex-json-events",
        "Codex JSON event stream",
        codex.execJson,
        codex.execJson ? "codex exec --help exposes --json." : "Selected Codex CLI did not expose codex exec --json.",
        "Upgrade Codex CLI before using RelayDesk timeline rendering.",
        "warn"
      )
    );
    checks.push(
      check(
        "codex-path-shadow",
        "Codex PATH shadow",
        !codex.pathDefault || sameCliPath(codex.pathDefault.path, codex.selected.path),
        codex.pathDefault
          ? `PATH: ${codex.pathDefault.version || "unknown"} at ${codex.pathDefault.path}\nSelected: ${codex.selected.version || "unknown"} at ${codex.selected.path}`
          : "No PATH Codex candidate was found.",
        "Update PATH, or configure RelayDesk to call the selected Codex binary explicitly.",
        "warn"
      )
    );
  }
  if (codex.config.exists && codex.config.serviceTier && !["fast", "flex"].includes(codex.config.serviceTier)) {
    checks.push(
      check(
        "codex-service-tier",
        "Codex service_tier compatibility",
        false,
        `~/.codex/config.toml has service_tier = "${codex.config.serviceTier}". Older Codex CLI builds reject values outside fast/flex.`,
        "Use a current Codex binary or change service_tier to fast/flex for broad CLI compatibility.",
        "warn"
      )
    );
  }

  return {
    checks,
    agents: {
      claude,
      codex
    }
  };
}

async function doctor(config) {
  const source = configSource();
  const checks = [];
  checks.push(check("node", "Node.js runtime", true, process.version));
  checks.push(check("config-source", "Runner config file", Boolean(source.path), source.path || "Using built-in defaults.", "Copy relay.config.example.json to relay.local.json.", source.kind === "example" ? "warn" : "fail"));
  checks.push(check("config-parse", "Config parse", !config.configError, config.configError || "Config loaded."));

  const gitignore = existsSync(join(root, ".gitignore")) ? await readFile(join(root, ".gitignore"), "utf8") : "";
  checks.push(check("gitignore-local-config", "Local config ignored", gitignore.includes("relay.local.json"), "relay.local.json should not be committed.", "Add relay.local.json to .gitignore."));
  checks.push(check("gitignore-evidence", "Evidence snapshots ignored", gitignore.includes(".relaydesk/"), ".relaydesk/ stores screenshots and should stay private.", "Add .relaydesk/ to .gitignore."));
  checks.push(check("gitignore-logs", "Runtime logs ignored", gitignore.includes("*.log"), "Runtime logs may contain local paths.", "Add *.log to .gitignore.", "warn"));

  checks.push(await commandCheck("git", "Git available", ["git", "--version"], root, "Install Git and make it available on PATH."));
  checks.push(runnerSessionUniqueness(config));

  const needsWsl = usesWsl(config);
  if (needsWsl) {
    checks.push(await wslCheck("wsl", "WSL available", "printf 'WSL available: '; uname -sr", "Install WSL or switch runner tmux.mode to native."));
    checks.push(await wslCheck("wsl-tmux", "tmux available in WSL", "command -v tmux && tmux -V", "Install tmux inside WSL."));
    checks.push(await tmuxSmokeCheck("wsl-tmux-smoke", "WSL tmux session smoke", "wsl", "Check WSL tmux server permissions and shell startup."));
    if (hasRunnerCommand(config, "claude")) {
      checks.push(await wslCheck("wsl-claude", "Claude Code available in WSL", "command -v claude && claude --version", "Install/login Claude Code inside WSL."));
    }
    if (usesPlainWslCodex(config)) {
      const wslCodex = await wslCheck("wsl-codex", "Codex CLI available in WSL", "command -v codex && codex --version", "Install/login Codex CLI inside WSL.");
      checks.push(wslCodex);
      if (wslCodex.status === "ok") {
        const version = parseCodexVersion(wslCodex.detail);
        checks.push(
          check(
            "wsl-codex-gpt-55",
            "WSL Codex gpt-5.5 capable",
            Boolean(version && semverGte(version, minCodexGpt55Version)),
            version ? `${version} in WSL; known minimum for this workflow is ${minCodexGpt55Version}.` : wslCodex.detail,
            "Upgrade WSL Codex CLI or point the runner start command at a newer Codex binary.",
            "warn"
          )
        );
      }
    }
  }

  if (!needsWsl || usesNativeTmux(config)) {
    checks.push(await commandCheck("tmux", "tmux available", ["tmux", "-V"], root, "Install tmux or use a WSL runner adapter."));
    if (usesNativeTmux(config)) {
      checks.push(await tmuxSmokeCheck("tmux-smoke", "Native tmux session smoke", "native", "Check native tmux permissions and shell startup."));
    }
  }

  const projects = (config.projects || []).map((project) => ({
    id: project.id,
    name: project.name,
    path: project.path,
    exists: Boolean(project.path && existsSync(project.path)),
    runners: (project.runners || []).map((runner) => ({
      id: runner.id,
      name: runner.name,
      kind: runner.kind,
      session: runner.session,
      configured: Boolean(runner.kind === "tmux" ? runner.session && runner.tmux?.startCommand : runner.commands)
    }))
  }));

  for (const project of projects) {
    checks.push(check(`project-${project.id}`, `${project.name} path`, project.exists, project.path || "No project path configured.", "Set this project path in relay.local.json."));
    for (const runner of project.runners) {
      checks.push(check(`runner-${project.id}-${runner.id}`, `${project.name} / ${runner.name}`, runner.configured, runner.session || runner.id, "Configure runner session and start command."));
      const rawProject = (config.projects || []).find((item) => item.id === project.id) || project;
      const rawRunner = (rawProject.runners || []).find((item) => item.id === runner.id) || runner;
      if (rawRunner.kind === "tmux") {
        checks.push(await runnerCwdCheck(rawProject, rawRunner));
      }
    }
  }

  const agentParity = await agentParityChecks(config);
  checks.push(...agentParity.checks);

  const summary = checks.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] += 1;
      return acc;
    },
    { ok: 0, warn: 0, fail: 0, total: 0 }
  );

  return {
    platform: process.platform,
    node: process.version,
    config: source,
    agents: agentParity.agents,
    summary,
    checks,
    projects
  };
}

function windowsCommandLineQuote(value) {
  const text = String(value);
  if (!/[ \t"&|<>^]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function runCommand(argv, cwd, timeoutMs = 15000) {
  return new Promise((resolveCommand) => {
    if (!Array.isArray(argv) || !argv.length || argv.some((part) => typeof part !== "string")) {
      resolveCommand({ ok: false, code: -1, stdout: "", stderr: "Command must be an argv string array." });
      return;
    }
    let stdout = "";
    let stderr = "";
    let child;
    const isWindowsCmd = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(argv[0]);
    const spawnArgv = isWindowsCmd
      ? ["cmd.exe", ["/d", "/s", "/c", [argv[0], ...argv.slice(1)].map(windowsCommandLineQuote).join(" ")]]
      : [argv[0], argv.slice(1)];
    try {
      child = spawn(spawnArgv[0], spawnArgv[1], {
        cwd,
        windowsHide: true,
        shell: false
      });
    } catch (error) {
      resolveCommand({ ok: false, code: -1, stdout: "", stderr: String(error) });
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolveCommand({ ok: false, code: -1, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms`.trim() });
    }, timeoutMs);
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveCommand({ ok: false, code: -1, stdout, stderr: String(error) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveCommand({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function spawnDetached(argv, cwd) {
  return new Promise((resolveSpawn) => {
    if (!Array.isArray(argv) || !argv.length) {
      resolveSpawn({ ok: false, code: -1, stdout: "", stderr: "Command must be a non-empty argv array." });
      return;
    }
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolveSpawn(value);
    };
    try {
      const child = spawn(argv[0], argv.slice(1), {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: false,
        shell: false
      });
      child.once("error", (error) => {
        settle({ ok: false, code: -1, stdout: "", stderr: String(error) });
      });
      child.unref();
      setTimeout(() => {
        settle({ ok: true, code: 0, stdout: `Opened: ${argv.join(" ")}`, stderr: "" });
      }, 500);
    } catch (error) {
      settle({ ok: false, code: -1, stdout: "", stderr: String(error) });
    }
  });
}

function isTmuxRunner(runner) {
  return runner.kind === "tmux" && runner.session && runner.tmux;
}

function tmuxBase(runner) {
  const mode = runner.tmux?.mode || "wsl";
  if (mode === "native") return ["tmux"];
  return ["wsl.exe", "--exec", "tmux"];
}

function tmuxArgs(runner, args) {
  return [...tmuxBase(runner), ...args];
}

function tmuxAttachArgs(runner) {
  return tmuxArgs(runner, ["attach-session", "-t", runner.session]);
}

function runnerCwd(project, runner) {
  return runner.tmux?.hostCwd || project.path || root;
}

async function runTmux(project, runner, args, timeoutMs = 10000) {
  return runCommand(tmuxArgs(runner, args), runnerCwd(project, runner), timeoutMs);
}

async function tmuxStatus(project, runner) {
  const result = await runTmux(project, runner, ["has-session", "-t", runner.session], 8000);
  const missingServer = /error connecting to .*tmux.*No such file or directory/i.test(result.stderr || "");
  return {
    id: runner.id,
    name: runner.name,
    kind: runner.kind,
    session: runner.session,
    state: result.ok ? "running" : "stopped",
    lastOutput: result.ok ? result.stdout : missingServer ? "No tmux server is running." : result.stderr,
    code: result.code
  };
}

async function startTmuxRunner(project, runner) {
  const status = await tmuxStatus(project, runner);
  if (status.state === "running") {
    return { ok: true, code: 0, stdout: `${runner.session} already running`, stderr: "" };
  }
  const startCommand = runner.tmux?.startCommand;
  if (!startCommand) {
    return { ok: false, code: -1, stdout: "", stderr: "tmux.startCommand is not configured." };
  }
  const cwd = runner.tmux?.cwd || project.path;
  const args = ["new-session", "-d", "-s", runner.session];
  if (cwd) args.push("-c", cwd);
  args.push(startCommand);
  const result = await runTmux(project, runner, args, 15000);
  if (result.ok) await dismissStartupPrompts(project, runner);
  return result;
}

async function stopTmuxRunner(project, runner) {
  return runTmux(project, runner, ["kill-session", "-t", runner.session], 10000);
}

async function captureTmuxRunner(project, runner) {
  return runTmux(project, runner, ["capture-pane", "-p", "-t", runner.session], 10000);
}

async function sendTmuxRunner(project, runner, text) {
  const value = String(text || "").trim();
  if (!value) return { ok: false, code: -1, stdout: "", stderr: "No text to send." };
  return runTmux(project, runner, ["send-keys", "-t", runner.session, "--", value, "Enter"], 10000);
}

async function dismissStartupPrompts(project, runner) {
  if (!runner.tmux?.dismissCodexUpdatePrompt) return;
  await sleep(2500);
  const capture = await captureTmuxRunner(project, runner);
  if (/Update available![\s\S]*Skip until next version/i.test(capture.stdout || "")) {
    await runTmux(project, runner, ["send-keys", "-t", runner.session, "--", "3", "Enter"], 10000);
    await sleep(1200);
  }
}

async function openTmuxTerminal(project, runner) {
  const status = await tmuxStatus(project, runner);
  if (status.state !== "running") {
    return { ok: false, code: -1, stdout: "", stderr: `${runner.session} is not running.` };
  }
  const title = `RelayDesk ${project.name} ${runner.session}`;
  const attach = tmuxAttachArgs(runner);
  const wtResult = await spawnDetached(["wt.exe", "new-tab", "--title", title, ...attach], runnerCwd(project, runner));
  if (wtResult.ok) return wtResult;
  return spawnDetached(["cmd.exe", "/c", "start", title, ...attach], runnerCwd(project, runner));
}

async function runRunnerAction(project, runner, action, body = {}) {
  if (isTmuxRunner(runner)) {
    if (action === "status") return tmuxStatus(project, runner);
    if (action === "start") return startTmuxRunner(project, runner);
    if (action === "stop") return stopTmuxRunner(project, runner);
    if (action === "restart") {
      await stopTmuxRunner(project, runner).catch(() => undefined);
      return startTmuxRunner(project, runner);
    }
    if (action === "peek") return captureTmuxRunner(project, runner);
    if (action === "capture") return captureTmuxRunner(project, runner);
    if (action === "send") return sendTmuxRunner(project, runner, body.text);
    if (action === "open") return openTmuxTerminal(project, runner);
  }

  const command = runner.commands?.[action];
  if (!command) {
    return { ok: false, code: -1, stdout: "", stderr: `Runner action '${action}' is not configured.` };
  }
  return runCommand(command, project.path, action === "status" ? 8000 : 30000);
}

async function gitContext(project) {
  const cwd = project.path;
  const [branch, status, stat] = await Promise.all([
    runCommand(["git", "branch", "--show-current"], cwd, 10000),
    runCommand(["git", "status", "--short"], cwd, 10000),
    runCommand(["git", "diff", "--stat"], cwd, 10000)
  ]);
  return {
    projectId: project.id,
    projectName: project.name,
    path: cwd,
    branch: branch.stdout || "(unknown)",
    clean: status.ok && !status.stdout,
    status: status.stdout,
    diffStat: stat.stdout,
    errors: [branch, status, stat].filter((result) => !result.ok).map((result) => result.stderr || result.stdout)
  };
}

async function runnerStatus(project, runner) {
  if (isTmuxRunner(runner)) {
    return tmuxStatus(project, runner);
  }
  if (!runner.commands?.status) {
    return { id: runner.id, name: runner.name, kind: runner.kind, session: runner.session, state: "unconfigured" };
  }
  const result = await runCommand(runner.commands.status, project.path, 8000);
  return {
    id: runner.id,
    name: runner.name,
    kind: runner.kind,
    session: runner.session,
    state: result.ok ? "running" : "stopped",
    lastOutput: result.stdout || result.stderr,
    code: result.code
  };
}

async function route(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const config = await loadConfig();

  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { ok: true, configError: config.configError || "" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/doctor") {
    json(res, 200, await doctor(config));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    json(res, 200, {
      source: configSource(),
      config: editableConfig(config)
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/config") {
    const body = await readBody(req);
    try {
      const next = await editConfig(config, body);
      json(res, 200, {
        ok: true,
        source: { path: localConfigPath(), kind: "local" },
        config: next,
        at: new Date().toISOString()
      });
    } catch (error) {
      json(res, 400, { ok: false, error: String(error) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/usage") {
    json(res, 200, usageSnapshot());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/sessions") {
    const project = findProject(config, url.searchParams.get("projectId"));
    if (!project) return notFound(res);
    json(res, 200, await listSessions(project));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sessions") {
    const body = await readBody(req);
    const project = findProject(config, body.projectId);
    if (!project) return notFound(res);
    try {
      const session = await editSession(project, body);
      json(res, 200, { ok: true, session, at: new Date().toISOString() });
    } catch (error) {
      json(res, 400, { ok: false, error: String(error) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/evidence") {
    const project = findProject(config, url.searchParams.get("projectId"));
    if (!project) return notFound(res);
    await sendEvidenceFile(res, project, url.searchParams.get("name"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    json(res, 200, {
      projects: (config.projects || []).map((project) => ({
        id: project.id,
        name: project.name,
        path: project.path,
        runnerCount: (project.runners || []).length
      }))
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/git") {
    const project = findProject(config, url.searchParams.get("projectId"));
    if (!project) return notFound(res);
    json(res, 200, await gitContext(project));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runners") {
    const project = findProject(config, url.searchParams.get("projectId"));
    if (!project) return notFound(res);
    const runners = await Promise.all((project.runners || []).map((runner) => runnerStatus(project, runner)));
    json(res, 200, { projectId: project.id, runners });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/runner") {
    const body = await readBody(req);
    const project = findProject(config, body.projectId);
    if (!project) return notFound(res);
    const runner = findRunner(project, body.runnerId);
    if (!runner) return notFound(res);
    const action = body.action;
    if (!["start", "stop", "restart", "status", "peek", "capture", "send", "open"].includes(action)) {
      json(res, 400, { error: "Unsupported runner action." });
      return;
    }
    const result = await runRunnerAction(project, runner, action, body);
    if (action !== "peek") countUsage(project, runner, action, result);
    json(res, 200, { action, runnerId: runner.id, ...result, at: new Date().toISOString() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/evidence") {
    const body = await readBody(req);
    const project = findProject(config, body.projectId);
    if (!project) return notFound(res);
    const result = await saveEvidence(project, body);
    countUsage(
      project,
      { id: body.runnerId || body.source || "workspace", name: String(body.source || body.runnerId || "Workspace") },
      "snapshot",
      result,
      { evidenceBytes: result.evidence?.bytes || 0, detail: result.evidence?.hostPath || result.stderr || "" }
    );
    json(res, result.ok ? 200 : 400, { ...result, at: new Date().toISOString() });
    return;
  }

  if (await serveStatic(req, res, url)) return;

  notFound(res);
}

createServer((req, res) => {
  route(req, res).catch((error) => {
    json(res, 500, { error: String(error) });
  });
}).listen(port, host, () => {
  console.log(`RelayDesk listening on http://${host}:${port}`);
  console.log(`RelayDesk data dir: ${dataRoot}`);
});
