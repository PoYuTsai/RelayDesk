import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const port = Number(process.env.RELAYDESK_PORT || 8791);

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
  const local = join(root, "relay.local.json");
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
  return join(root, "relay.local.json");
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
  const local = join(root, "relay.local.json");
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
  return resolve(root, ".relaydesk", "evidence", safeSegment(project.id));
}

function sessionsFile() {
  return resolve(root, ".relaydesk", "sessions.json");
}

function emptySessionState(body = {}) {
  return {
    activeStep: String(body.activeStep || "Discuss"),
    task: String(body.task || ""),
    decisions: Array.isArray(body.decisions) ? body.decisions : [],
    evidence: Array.isArray(body.evidence) ? body.evidence : [],
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
    if (hasRunnerCommand(config, "codex")) {
      checks.push(await wslCheck("wsl-codex", "Codex CLI available in WSL", "command -v codex && codex --version", "Install/login Codex CLI inside WSL."));
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
    summary,
    checks,
    projects
  };
}

function runCommand(argv, cwd, timeoutMs = 15000) {
  return new Promise((resolveCommand) => {
    if (!Array.isArray(argv) || !argv.length || argv.some((part) => typeof part !== "string")) {
      resolveCommand({ ok: false, code: -1, stdout: "", stderr: "Command must be an argv string array." });
      return;
    }
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      windowsHide: true,
      shell: false
    });
    let stdout = "";
    let stderr = "";
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

  notFound(res);
}

createServer((req, res) => {
  route(req, res).catch((error) => {
    json(res, 500, { error: String(error) });
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`RelayDesk API listening on http://127.0.0.1:${port}`);
});
