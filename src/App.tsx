import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  BookOpen,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  CircleDot,
  Copy,
  FileDiff,
  FolderGit2,
  GitBranch,
  Globe2,
  Image,
  Inbox,
  ListChecks,
  Play,
  Plus,
  Power,
  RefreshCcw,
  Send,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Upload,
  Workflow
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  path: string;
  runnerCount: number;
};

type ConfigRunner = {
  id: string;
  name: string;
  kind: string;
  session: string;
  tmux?: {
    mode?: "wsl" | "native";
    cwd?: string;
    startCommand?: string;
    dismissCodexUpdatePrompt?: boolean;
  };
};

type ConfigProject = {
  id: string;
  name: string;
  path: string;
  runners: ConfigRunner[];
};

type ConfigContext = {
  source: {
    path: string;
    kind: string;
  };
  config: {
    projects: ConfigProject[];
  };
};

type GitContext = {
  projectId: string;
  branch: string;
  clean: boolean;
  status: string;
  diffStat: string;
  errors: string[];
};

type Runner = {
  id: string;
  name: string;
  kind: string;
  session: string;
  state: "running" | "stopped" | "unconfigured";
  lastOutput?: string;
  code?: number;
};

type DoctorCheck = {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  fix?: string;
};

type DoctorContext = {
  platform: string;
  node: string;
  summary: {
    ok: number;
    warn: number;
    fail: number;
    total: number;
  };
  checks: DoctorCheck[];
};

type UsageRunner = {
  key: string;
  projectId: string;
  projectName: string;
  runnerId: string;
  runnerName: string;
  starts: number;
  stops: number;
  restarts: number;
  sends: number;
  captures: number;
  opens: number;
  snapshots: number;
  outputChars: number;
  evidenceBytes: number;
  failures: number;
  lastAction: string;
  lastAt: string;
};

type UsageContext = {
  startedAt: string;
  totals: {
    starts: number;
    stops: number;
    restarts: number;
    sends: number;
    captures: number;
    opens: number;
    snapshots: number;
    outputChars: number;
    evidenceBytes: number;
    failures: number;
  };
  runners: UsageRunner[];
  recentActions: Array<{
    at: string;
    projectId: string;
    projectName: string;
    runnerId: string;
    runnerName: string;
    action: string;
    ok: boolean;
    outputChars: number;
    evidenceBytes: number;
    detail: string;
  }>;
};

type Lang = "en" | "zh-TW";

type Evidence = {
  id: string;
  name: string;
  kind: "image" | "video" | "log";
  size: string;
  source?: string;
  path?: string;
  wslPath?: string;
  previewUrl?: string;
};

type DecisionItem = {
  id: string;
  source: string;
  title: string;
  prompt: string;
  options: string[];
  selected: string;
  note: string;
  replyDraft: string;
  status: "open" | "sent";
};

type RelaySessionState = {
  activeStep: string;
  task: string;
  decisions: DecisionItem[];
  evidence: Evidence[];
  selectedEvidenceId: string;
  writerRunnerId: string;
  commandRunnerId: string;
  consoleOutput: string;
};

type RelaySession = {
  id: string;
  projectId: string;
  title: string;
  status: "active" | "archived" | "deleted";
  createdAt: string;
  updatedAt: string;
  state: RelaySessionState;
};

const steps = ["Discuss", "Synthesize", "Build", "Review", "Verify"];

const slashCommandPresets = [
  { id: "help", label: "/help", command: "/help", hint: "Show commands available in the selected CLI" },
  { id: "clear", label: "/clear", command: "/clear", hint: "Start fresh or clear context, depending on the CLI" },
  { id: "compact", label: "/compact", command: "/compact", hint: "Summarize long context where supported" }
];

const doctorPriorityIds = [
  "runner-session-unique",
  "wsl-tmux-smoke",
  "tmux-smoke",
  "wsl-claude",
  "wsl-codex",
  "gitignore-local-config",
  "gitignore-evidence"
];

const setupCopy: Record<
  Lang,
  {
    label: string;
    title: string;
    subtitle: string;
    install: string;
    config: string;
    run: string;
    copied: string;
    checks: {
      config: string;
      paths: string;
      terminal: string;
      agents: string;
    };
    commands: {
      install: string;
      config: string;
      run: string;
    };
    compat: string;
    docs: string;
  }
> = {
  en: {
    label: "Setup",
    title: "Quick start guide",
    subtitle: "Use Doctor as the source of truth, then copy the commands you need.",
    install: "Install deps",
    config: "Copy config",
    run: "Run app",
    copied: "Copied",
    checks: {
      config: "Local config loaded",
      paths: "Project paths exist",
      terminal: "WSL/tmux ready",
      agents: "Agent CLIs found"
    },
    commands: {
      install: "npm.cmd install",
      config: "Copy-Item relay.config.example.json relay.local.json",
      run: "npm.cmd run api\nnpm.cmd run dev"
    },
    compat: "Compatibility",
    docs: "README + setup docs"
  },
  "zh-TW": {
    label: "設定",
    title: "快速上手",
    subtitle: "先看 Doctor 結果，再複製需要的指令。",
    install: "安裝套件",
    config: "複製設定",
    run: "啟動服務",
    copied: "已複製",
    checks: {
      config: "本機設定已載入",
      paths: "專案路徑存在",
      terminal: "WSL/tmux 可用",
      agents: "Agent CLI 找得到"
    },
    commands: {
      install: "npm.cmd install",
      config: "Copy-Item relay.config.example.json relay.local.json",
      run: "npm.cmd run api\nnpm.cmd run dev"
    },
    compat: "相容性",
    docs: "README 與設定文件"
  }
};

const seedEvidence: Evidence[] = [
  { id: "ev-1", name: "opener-upload-failure.png", kind: "image", size: "1280x720" },
  { id: "ev-2", name: "dogfood-repro.mp4", kind: "video", size: "6 frames" },
  { id: "ev-3", name: "edge-function.log", kind: "log", size: "18 KB" }
];

const seedDecisions: DecisionItem[] = [
  {
    id: "decision-root-lane",
    source: "Both agents",
    title: "First root-cause lane",
    prompt: "Which lane should the builder verify before editing?",
    options: ["Image picker permission", "Compressed file path", "Opener request boundary"],
    selected: "Image picker permission",
    note: "Keep quota and OCR untouched until the failing upload path is confirmed.",
    replyDraft: "",
    status: "open"
  },
  {
    id: "decision-evidence",
    source: "Codex review",
    title: "Evidence gate",
    prompt: "What evidence must exist before patching?",
    options: ["Device log + screenshot", "Simulator repro only", "Patch after code read"],
    selected: "Device log + screenshot",
    note: "Dogfood/TestFlight behavior is the target path.",
    replyDraft: "",
    status: "open"
  }
];

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function cleanCaptureLine(line: string) {
  return line
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[╭╮╰╯│─▐▛▜▌▝▘]/g, " ")
    .trim();
}

function extractOption(line: string) {
  const cleaned = cleanCaptureLine(line)
    .replace(/^\s*(?:[-*•]|\d+[.)]|[A-Z][.)]|\[[ xX]\])\s*/, "")
    .replace(/\s+\((?:recommended|建議|推薦)\)$/i, "")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= 90 ? cleaned : "";
}

function looksLikeQuestion(line: string) {
  return (
    /[?？]\s*$/.test(line) ||
    /^(?:question|decision|blocked|choose|which|should|do you|請選擇|需要你|決策|問題)[:：\s]/i.test(line)
  );
}

function makeDecisionTitle(prompt: string) {
  const normalized = prompt.replace(/^(?:question|decision|問題|決策)[:：\s]+/i, "").trim();
  return normalized.length > 58 ? `${normalized.slice(0, 55)}...` : normalized || "Captured decision";
}

function buildAgentReply(decision: DecisionItem, task: string) {
  return [
    "Relay request for reviewer:",
    `Source: ${decision.source}`,
    `Decision: ${decision.title}`,
    `Question: ${decision.prompt}`,
    `Current choice: ${decision.selected}`,
    decision.note ? `Context: ${decision.note}` : "",
    `Task: ${task}`,
    "Please challenge this decision before the source agent continues.",
    "If you disagree, identify the biggest risk and the evidence needed.",
    "If you agree, give the smallest verification step and call out files or areas that must stay untouched."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReturnVerdict(decision: DecisionItem, task: string) {
  return [
    "Relay verdict back to source agent:",
    `Decision: ${decision.title}`,
    `我會選「${decision.selected}」。`,
    decision.note ? `Reason / reviewer note: ${decision.note}` : "",
    `Task: ${task}`,
    "Continue from this decision. Keep the patch minimal, avoid unrelated files, and stop to ask if the next step would touch a high-risk area."
  ]
    .filter(Boolean)
    .join("\n");
}

function snapshotReply(runner: Runner, task: string, hostPath: string, wslPath: string) {
  return [
    `Snapshot from ${runner.session}`,
    `Windows file: ${hostPath}`,
    `WSL file: ${wslPath}`,
    `Task: ${task}`,
    "Please do a second-pass check on this agent conversation snapshot.",
    "Focus on whether the source agent is blocked, asking for a decision, showing a risky command, or missing evidence.",
    "If you cannot inspect the image directly, ask me for OCR text or a cropped follow-up snapshot."
  ].join("\n");
}

function evidenceHandoffText(item: Evidence, task: string) {
  return [
    `Evidence handoff: ${item.name}`,
    `Type: ${item.kind}`,
    item.source ? `Source: ${item.source}` : "",
    item.path ? `Windows file: ${item.path}` : "",
    item.wslPath ? `WSL file: ${item.wslPath}` : "",
    `Task: ${task}`,
    "Please review this evidence before the next agent step.",
    "Focus on whether it changes the root cause, risk level, reproduction path, or next command.",
    "If you cannot inspect the file directly, ask me for OCR text, logs, or a focused follow-up snapshot."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSessionBrief(input: {
  sessionKey: string;
  projectName: string;
  writerName: string;
  task: string;
  runners: Runner[];
  decisions: DecisionItem[];
  evidence: Evidence[];
  git: GitContext | null;
}) {
  const openDecisions = input.decisions.filter((item) => item.status === "open").length;
  const sentDecisions = input.decisions.filter((item) => item.status === "sent").length;
  return [
    `RelayDesk session: ${input.sessionKey}`,
    `Project: ${input.projectName}`,
    `Active writer: ${input.writerName || "unassigned"}`,
    `Task: ${input.task}`,
    `Git: ${input.git?.clean ? "clean" : "dirty or unknown"} (${input.git?.branch || "unknown branch"})`,
    `Runners: ${input.runners.map((runner) => `${runner.name}=${runner.state}`).join(", ") || "none"}`,
    `Decisions: ${openDecisions} open / ${sentDecisions} sent`,
    `Evidence: ${input.evidence.length} item${input.evidence.length === 1 ? "" : "s"}`,
    "",
    "Use this brief to continue the same local-agent workflow. Verify disk state before trusting any agent claim."
  ].join("\n");
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some localhost and embedded-browser contexts block Clipboard API writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Clipboard write is unavailable.");
  } finally {
    document.body.removeChild(textarea);
  }
}

async function captureDisplayFrame() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture is not available in this browser context.");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load captured video stream."));
    });
    await video.play();
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create snapshot canvas.");
    context.drawImage(video, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

function RunnerDot({ state }: { state: Runner["state"] }) {
  return <span className={cx("runner-dot", state)} />;
}

function AppShellSkeleton() {
  return (
    <div className="loading-shell">
      <Activity className="spin" size={18} />
      Loading RelayDesk
    </div>
  );
}

function compactNumber(value = 0) {
  return new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function formatBytes(bytes = 0) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatTime(value: string) {
  if (!value) return "never";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "unknown";
  return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortRunnerName(name: string) {
  return name.replace(/\s+tmux$/i, "").replace(/\s+CLI$/i, "");
}

function toWslPathClient(path: string) {
  const normalized = path.trim().replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return normalized;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

function runnerDefaults(project: Project | undefined, type: string) {
  const projectId = project?.id || "project";
  const projectPath = project?.path || "";
  const cwd = toWslPathClient(projectPath);
  if (type === "claude-code") {
    return {
      id: "claude-code",
      name: "Claude Code tmux",
      session: `rc-${projectId}`,
      cwd,
      startCommand: `bash -lc 'cd ${cwd || "."} && claude'`
    };
  }
  if (type === "codex-cli") {
    return {
      id: "codex-cli",
      name: "Codex CLI tmux",
      session: `rc-codex-${projectId}`,
      cwd,
      startCommand: `bash -lc 'cd ${cwd || "."} && codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox -C ${cwd || "."}'`
    };
  }
  return {
    id: "custom",
    name: "Custom tmux",
    session: `rc-${projectId}-custom`,
    cwd,
    startCommand: `bash -lc 'cd ${cwd || "."} && echo \"configure this runner\"'`
  };
}

function clientId(value: string, fallback = "item") {
  return (
    (value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || fallback
  );
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [config, setConfig] = useState<ConfigContext | null>(null);
  const [git, setGit] = useState<GitContext | null>(null);
  const [doctor, setDoctor] = useState<DoctorContext | null>(null);
  const [usage, setUsage] = useState<UsageContext | null>(null);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [activeStep, setActiveStep] = useState("Discuss");
  const [task, setTask] = useState("Opener dogfood upload screenshot fails after image picker returns.");
  const [busyRunner, setBusyRunner] = useState<string | null>(null);
  const [lastRunnerOutput, setLastRunnerOutput] = useState("");
  const [evidence, setEvidence] = useState(seedEvidence);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(seedEvidence[0]?.id || "");
  const [decisions, setDecisions] = useState(seedDecisions);
  const [decisionDraft, setDecisionDraft] = useState("");
  const [copiedDecision, setCopiedDecision] = useState("");
  const [copiedSetup, setCopiedSetup] = useState("");
  const [copiedSessionBrief, setCopiedSessionBrief] = useState(false);
  const [sessionStartedAt] = useState(() => new Date().toISOString());
  const [sessions, setSessions] = useState<RelaySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [sessionBusy, setSessionBusy] = useState("");
  const [sessionLastSavedAt, setSessionLastSavedAt] = useState("");
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const [commandRunnerId, setCommandRunnerId] = useState("");
  const [writerRunnerId, setWriterRunnerId] = useState("");
  const [slashCommand, setSlashCommand] = useState("/help");
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [consoleAutoRefresh, setConsoleAutoRefresh] = useState(false);
  const [consoleLastCaptureAt, setConsoleLastCaptureAt] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [runnerType, setRunnerType] = useState("claude-code");
  const [runnerSession, setRunnerSession] = useState("");
  const [runnerCwd, setRunnerCwd] = useState("");
  const [runnerStartCommand, setRunnerStartCommand] = useState("");
  const [configBusy, setConfigBusy] = useState("");
  const [lang, setLang] = useState<Lang>("zh-TW");
  const [bootError, setBootError] = useState("");

  const activeProject = useMemo(
    () => projects.find((project) => project.id === projectId) || projects[0],
    [projects, projectId]
  );

  const activeConfigProject = useMemo(
    () => (config?.config.projects || []).find((project) => project.id === activeProject?.id),
    [config, activeProject?.id]
  );

  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.status !== "archived" || showArchivedSessions),
    [sessions, showArchivedSessions]
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [sessions, activeSessionId]
  );

  const visibleDoctorChecks = useMemo(() => {
    if (!doctor) return [];
    const issues = doctor.checks.filter((item) => item.status !== "ok");
    if (issues.length) return issues.slice(0, 9);
    const priority = doctorPriorityIds.map((id) => doctor.checks.find((item) => item.id === id)).filter(Boolean) as DoctorCheck[];
    const rest = doctor.checks.filter((item) => !doctorPriorityIds.includes(item.id));
    return [...priority, ...rest].slice(0, 9);
  }, [doctor]);

  const doctorById = useMemo(() => {
    return new Map((doctor?.checks || []).map((item) => [item.id, item]));
  }, [doctor]);

  const setup = setupCopy[lang];

  const commandRunner = useMemo(() => {
    return runners.find((runner) => runner.id === commandRunnerId) || runners.find((runner) => runner.state === "running") || runners[0];
  }, [runners, commandRunnerId]);

  const writerRunner = useMemo(() => {
    return runners.find((runner) => runner.id === writerRunnerId) || runners.find((runner) => runner.id === "claude-code") || runners[0];
  }, [runners, writerRunnerId]);

  const usageByRunner = useMemo(() => {
    return new Map(
      (usage?.runners || [])
        .filter((row) => row.projectId === activeProject?.id)
        .map((row) => [row.runnerId, row])
    );
  }, [usage, activeProject?.id]);

  const diskChangeCount = useMemo(() => {
    return (git?.status || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length;
  }, [git?.status]);

  const runnerPreset = useMemo(() => runnerDefaults(activeProject, runnerType), [activeProject, runnerType]);

  const selectedEvidence = useMemo(() => {
    return evidence.find((item) => item.id === selectedEvidenceId) || evidence[0];
  }, [evidence, selectedEvidenceId]);

  const selectedEvidencePreview = useMemo(() => {
    if (!selectedEvidence) return "";
    if (selectedEvidence.previewUrl) return selectedEvidence.previewUrl;
    if (!activeProject || !selectedEvidence.path) return "";
    return `/api/evidence?projectId=${encodeURIComponent(activeProject.id)}&name=${encodeURIComponent(selectedEvidence.name)}`;
  }, [activeProject?.id, selectedEvidence]);

  const sessionKey = useMemo(() => {
    if (activeSession?.id) return activeSession.id;
    const stamp = sessionStartedAt.replace(/[-:T.Z]/g, "").slice(0, 14);
    return `rd-${activeProject?.id || "project"}-${stamp}`;
  }, [activeProject?.id, activeSession?.id, sessionStartedAt]);

  const decisionCounts = useMemo(() => {
    return {
      open: decisions.filter((item) => item.status === "open").length,
      sent: decisions.filter((item) => item.status === "sent").length
    };
  }, [decisions]);

  const setupRows = useMemo(() => {
    const pathChecks = (doctor?.checks || []).filter((item) => item.id.startsWith("project-"));
    const terminalChecks = ["wsl", "wsl-tmux", "wsl-tmux-smoke", "tmux", "tmux-smoke"].map((id) => doctorById.get(id)).filter(Boolean) as DoctorCheck[];
    const agentChecks = ["wsl-claude", "wsl-codex"].map((id) => doctorById.get(id)).filter(Boolean) as DoctorCheck[];
    const statusFrom = (items: DoctorCheck[]) =>
      items.some((item) => item.status === "fail") ? "fail" : items.some((item) => item.status === "warn") ? "warn" : "ok";

    return [
      {
        id: "config",
        label: setup.checks.config,
        status: doctorById.get("config-source")?.status || "warn",
        detail: doctorById.get("config-source")?.detail || "relay.local.json"
      },
      {
        id: "paths",
        label: setup.checks.paths,
        status: pathChecks.length ? statusFrom(pathChecks) : "warn",
        detail: pathChecks.length ? `${pathChecks.length} project path${pathChecks.length === 1 ? "" : "s"}` : "No projects"
      },
      {
        id: "terminal",
        label: setup.checks.terminal,
        status: terminalChecks.length ? statusFrom(terminalChecks) : "warn",
        detail: terminalChecks.map((item) => item.label.replace(" available", "")).join(" / ") || "tmux"
      },
      {
        id: "agents",
        label: setup.checks.agents,
        status: agentChecks.length ? statusFrom(agentChecks) : "warn",
        detail: agentChecks.map((item) => item.label.replace(" available in WSL", "")).join(" / ") || "Claude / Codex"
      }
    ] satisfies Array<{ id: string; label: string; status: DoctorCheck["status"]; detail: string }>;
  }, [doctor?.checks, doctorById, setup]);

  function currentSessionState(): RelaySessionState {
    return {
      activeStep,
      task,
      decisions,
      evidence,
      selectedEvidenceId,
      writerRunnerId,
      commandRunnerId,
      consoleOutput
    };
  }

  function titleFromTask(value = task) {
    const title = value.trim().split(/\r?\n/)[0] || `${activeProject?.name || "Project"} session`;
    return title.length > 72 ? `${title.slice(0, 69)}...` : title;
  }

  function applySessionState(session: RelaySession) {
    const state = session.state || ({} as RelaySessionState);
    setActiveStep(steps.includes(state.activeStep) ? state.activeStep : "Discuss");
    setTask(state.task || "");
    setDecisions(Array.isArray(state.decisions) ? state.decisions : []);
    setEvidence(Array.isArray(state.evidence) ? state.evidence : []);
    setSelectedEvidenceId(state.selectedEvidenceId || state.evidence?.[0]?.id || "");
    setWriterRunnerId(state.writerRunnerId || "");
    setCommandRunnerId(state.commandRunnerId || "");
    setConsoleOutput(state.consoleOutput || "");
  }

  async function postSessionAction(body: Record<string, unknown>) {
    if (!activeProject) throw new Error("No active project.");
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: activeProject.id, ...body })
    });
    const result = (await response.json()) as { ok?: boolean; error?: string; session?: RelaySession };
    if (!response.ok || result.ok === false || !result.session) throw new Error(result.error || "Session action failed.");
    return result.session;
  }

  function mergeSession(nextSession: RelaySession) {
    setSessions((current) =>
      [nextSession, ...current.filter((session) => session.id !== nextSession.id)].sort((a, b) =>
        String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))
      )
    );
  }

  async function saveActiveSession(options: { silent?: boolean } = {}) {
    if (!activeProject || !activeSession || !sessionHydrated) return;
    if (!options.silent) setSessionBusy("save");
    try {
      const nextSession = await postSessionAction({
        action: "update",
        sessionId: activeSession.id,
        title: titleFromTask(),
        status: activeSession.status,
        state: currentSessionState()
      });
      mergeSession(nextSession);
      setSessionLastSavedAt(nextSession.updatedAt);
      return nextSession;
    } catch (error) {
      if (!options.silent) setLastRunnerOutput(`Session save failed: ${String(error)}`);
    } finally {
      if (!options.silent) setSessionBusy("");
    }
  }

  function emptyNewSessionState(): RelaySessionState {
    return {
      activeStep: "Discuss",
      task: "",
      decisions: [],
      evidence: [],
      selectedEvidenceId: "",
      writerRunnerId: writerRunner?.id || "",
      commandRunnerId: commandRunner?.id || "",
      consoleOutput: ""
    };
  }

  async function createSession() {
    if (!activeProject) return;
    setSessionHydrated(false);
    setSessionBusy("create");
    try {
      const nextSession = await postSessionAction({
        action: "create",
        title: `${activeProject.name} session`,
        state: emptyNewSessionState()
      });
      mergeSession(nextSession);
      setActiveSessionId(nextSession.id);
      applySessionState(nextSession);
      setSessionLastSavedAt(nextSession.updatedAt);
      setSessionHydrated(true);
    } catch (error) {
      setLastRunnerOutput(`Session create failed: ${String(error)}`);
    } finally {
      setSessionBusy("");
    }
  }

  async function selectSession(id: string) {
    const nextSession = sessions.find((session) => session.id === id);
    if (!nextSession || nextSession.id === activeSessionId) return;
    await saveActiveSession({ silent: true });
    setSessionHydrated(false);
    setActiveSessionId(nextSession.id);
    applySessionState(nextSession);
    setSessionHydrated(true);
  }

  async function archiveSession() {
    if (!activeProject || !activeSession) return;
    const ok = window.confirm(`Archive "${activeSession.title}"?`);
    if (!ok) return;
    await saveActiveSession({ silent: true });
    setSessionBusy("archive");
    try {
      const archived = await postSessionAction({ action: "archive", sessionId: activeSession.id });
      mergeSession(archived);
      const nextSession = sessions.find((session) => session.id !== activeSession.id && session.status === "active");
      if (nextSession) {
        setActiveSessionId(nextSession.id);
        applySessionState(nextSession);
      } else {
        const replacement = await postSessionAction({
          action: "create",
          title: `${activeProject.name} session`,
          state: emptyNewSessionState()
        });
        setSessions((current) => [
          replacement,
          archived,
          ...current.filter((session) => session.id !== activeSession.id && session.id !== archived.id && session.id !== replacement.id)
        ]);
        setActiveSessionId(replacement.id);
        applySessionState(replacement);
        setSessionLastSavedAt(replacement.updatedAt);
      }
    } catch (error) {
      setLastRunnerOutput(`Session archive failed: ${String(error)}`);
    } finally {
      setSessionBusy("");
    }
  }

  async function deleteSession() {
    if (!activeProject || !activeSession) return;
    const ok = window.confirm(`Delete "${activeSession.title}" from RelayDesk sessions? This will not delete project files or evidence files.`);
    if (!ok) return;
    setSessionBusy("delete");
    try {
      await postSessionAction({ action: "delete", sessionId: activeSession.id });
      const remaining = sessions.filter((session) => session.id !== activeSession.id);
      setSessions(remaining);
      const nextSession = remaining.find((session) => session.status === "active") || remaining[0];
      if (nextSession) {
        setActiveSessionId(nextSession.id);
        applySessionState(nextSession);
      } else {
        const replacement = await postSessionAction({
          action: "create",
          title: `${activeProject.name} session`,
          state: emptyNewSessionState()
        });
        setSessions([replacement]);
        setActiveSessionId(replacement.id);
        applySessionState(replacement);
        setSessionLastSavedAt(replacement.updatedAt);
      }
    } catch (error) {
      setLastRunnerOutput(`Session delete failed: ${String(error)}`);
    } finally {
      setSessionBusy("");
    }
  }

  async function loadSessions(project = activeProject) {
    if (!project) return;
    setSessionHydrated(false);
    setSessionBusy("load");
    try {
      const data = await getJson<{ projectId: string; sessions: RelaySession[] }>(`/api/sessions?projectId=${encodeURIComponent(project.id)}`);
      let nextSessions = data.sessions || [];
      if (!nextSessions.length) {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            action: "create",
            title: titleFromTask(),
            state: currentSessionState()
          })
        });
        const result = (await response.json()) as { ok?: boolean; session?: RelaySession; error?: string };
        if (!response.ok || result.ok === false || !result.session) throw new Error(result.error || "Session create failed.");
        nextSessions = [result.session];
      }
      setSessions(nextSessions);
      const preferred = nextSessions.find((session) => session.status === "active") || nextSessions[0];
      setActiveSessionId(preferred?.id || "");
      if (preferred) applySessionState(preferred);
      setSessionHydrated(true);
    } catch (error) {
      setLastRunnerOutput(`Session load failed: ${String(error)}`);
    } finally {
      setSessionBusy("");
    }
  }

  async function refresh(project = activeProject) {
    if (!project) return;
    const [nextGit, nextRunners, nextDoctor, nextUsage, nextConfig] = await Promise.all([
      getJson<GitContext>(`/api/git?projectId=${encodeURIComponent(project.id)}`),
      getJson<{ runners: Runner[] }>(`/api/runners?projectId=${encodeURIComponent(project.id)}`),
      getJson<DoctorContext>("/api/doctor"),
      getJson<UsageContext>("/api/usage"),
      getJson<ConfigContext>("/api/config")
    ]);
    setGit(nextGit);
    setRunners(nextRunners.runners);
    setDoctor(nextDoctor);
    setUsage(nextUsage);
    setConfig(nextConfig);
  }

  useEffect(() => {
    Promise.all([getJson<{ projects: Project[] }>("/api/projects"), getJson<ConfigContext>("/api/config")])
      .then(([projectData, configData]) => {
        setProjects(projectData.projects);
        setConfig(configData);
        setProjectId(projectData.projects[0]?.id || "");
      })
      .catch((error) => setBootError(String(error)));
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    void refresh(activeProject);
    void loadSessions(activeProject);
  }, [activeProject?.id]);

  useEffect(() => {
    if (!sessionHydrated || !activeProject || !activeSession || sessionBusy) return;
    const timer = window.setTimeout(() => {
      void saveActiveSession({ silent: true });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    activeProject?.id,
    activeSessionId,
    activeStep,
    task,
    decisions,
    evidence,
    selectedEvidenceId,
    writerRunnerId,
    commandRunnerId,
    consoleOutput,
    sessionHydrated,
    sessionBusy
  ]);

  useEffect(() => {
    if (!runners.length) return;
    if (commandRunnerId && runners.some((runner) => runner.id === commandRunnerId)) return;
    const preferred = runners.find((runner) => runner.state === "running") || runners[0];
    setCommandRunnerId(preferred.id);
  }, [runners, commandRunnerId]);

  useEffect(() => {
    if (!runners.length) return;
    if (writerRunnerId && runners.some((runner) => runner.id === writerRunnerId)) return;
    const preferred = runners.find((runner) => runner.id === "claude-code") || runners[0];
    setWriterRunnerId(preferred.id);
  }, [runners, writerRunnerId]);

  useEffect(() => {
    if (!consoleAutoRefresh || !commandRunner || commandRunner.state !== "running") return;
    const interval = window.setInterval(() => {
      void captureConsole(commandRunner, { mode: "peek", silent: true });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [activeProject?.id, commandRunner?.id, commandRunner?.state, consoleAutoRefresh]);

  async function runRunner(
    runner: Runner,
    action: "start" | "stop" | "restart" | "status" | "capture" | "send" | "open",
    options: { text?: string; confirmMessage?: string; onSuccess?: () => void } = {}
  ) {
    if (!activeProject) return;
    if (["stop", "restart"].includes(action)) {
      const ok = window.confirm(`${action.toUpperCase()} ${runner.name} (${runner.session})?`);
      if (!ok) return;
    }
    if (action === "send") {
      const ok = window.confirm(options.confirmMessage || `Send the current task to ${runner.session}?`);
      if (!ok) return;
    }
    setBusyRunner(`${runner.id}:${action}`);
    setLastRunnerOutput("");
    try {
      const response = await fetch("/api/runner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: activeProject.id, runnerId: runner.id, action, text: options.text ?? task })
      });
      const result = (await response.json()) as {
        ok: boolean;
        stdout: string;
        stderr: string;
        code: number;
        action: string;
      };
      const output =
        [result.stdout, result.stderr].filter(Boolean).join("\n") ||
        `${action}: ${result.ok === false ? "failed" : "ok"}${typeof result.code === "number" ? ` (exit ${result.code})` : ""}`;
      const capturedDecisionCount = action === "capture" && result.ok !== false ? captureDecisions(output, runner) : 0;
      setLastRunnerOutput(
        capturedDecisionCount > 0
          ? `${output}\n\nDecision Inbox: captured ${capturedDecisionCount} open call${capturedDecisionCount === 1 ? "" : "s"}.`
          : output
      );
      if (result.ok !== false) options.onSuccess?.();
      await refresh(activeProject);
    } catch (error) {
      setLastRunnerOutput(String(error));
    } finally {
      setBusyRunner(null);
    }
  }

  async function postRunnerAction(
    runner: Runner,
    action: "peek" | "capture" | "send",
    body: Record<string, unknown> = {}
  ) {
    if (!activeProject) throw new Error("No active project.");
    const response = await fetch("/api/runner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: activeProject.id, runnerId: runner.id, action, ...body })
    });
    const result = (await response.json()) as {
      ok?: boolean;
      stdout?: string;
      stderr?: string;
      code?: number;
      action?: string;
      error?: string;
    };
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || output || `${action} failed.`);
    }
    return { ...result, output };
  }

  async function captureConsole(
    runner = commandRunner,
    options: { mode?: "peek" | "capture"; silent?: boolean } = {}
  ) {
    const mode = options.mode || "capture";
    if (!runner) {
      const message = "No runner is configured for this project.";
      setConsoleOutput(message);
      if (!options.silent) setLastRunnerOutput(message);
      return;
    }
    if (runner.state !== "running") {
      const message = `Start ${runner.session} before reading the live pane.`;
      setConsoleOutput(message);
      if (!options.silent) setLastRunnerOutput(message);
      return;
    }

    if (!options.silent) {
      setBusyRunner(`${runner.id}:console-${mode}`);
    }
    try {
      const result = await postRunnerAction(runner, mode);
      const output = result.output || "Captured an empty tmux pane.";
      setConsoleOutput(output);
      setConsoleLastCaptureAt(new Date().toLocaleTimeString());
      if (mode === "capture") {
        const capturedDecisionCount = captureDecisions(output, runner);
        setLastRunnerOutput(
          capturedDecisionCount > 0
            ? `${output}\n\nDecision Inbox: captured ${capturedDecisionCount} open call${capturedDecisionCount === 1 ? "" : "s"}.`
            : output
        );
        await refresh(activeProject);
      }
    } catch (error) {
      const message = `Console ${mode} failed: ${String(error)}`;
      setConsoleOutput(message);
      if (!options.silent) setLastRunnerOutput(message);
    } finally {
      if (!options.silent) setBusyRunner(null);
    }
  }

  async function sendConsoleInput(value = consoleInput) {
    const text = value.trim();
    if (!text) return;
    if (!commandRunner) {
      const message = "No runner is configured for this project.";
      setConsoleOutput(message);
      setLastRunnerOutput(message);
      return;
    }
    if (commandRunner.state !== "running") {
      const message = `Start ${commandRunner.session} before sending console input.`;
      setConsoleOutput(message);
      setLastRunnerOutput(message);
      return;
    }

    setBusyRunner(`${commandRunner.id}:console-send`);
    try {
      await postRunnerAction(commandRunner, "send", { text });
      setConsoleInput("");
      setSlashCommand(text.startsWith("/") ? text : slashCommand);
      setConsoleOutput((current) => `${current ? `${current}\n\n` : ""}[RelayDesk sent to ${commandRunner.session}]\n${text}`);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
      await captureConsole(commandRunner, { mode: "peek", silent: true });
      await refresh(activeProject);
    } catch (error) {
      const message = `Console send failed: ${String(error)}`;
      setConsoleOutput(message);
      setLastRunnerOutput(message);
    } finally {
      setBusyRunner(null);
    }
  }

  async function snapshotRunner(runner: Runner) {
    if (!activeProject) return;
    setBusyRunner(`${runner.id}:snapshot`);
    setLastRunnerOutput("");
    try {
      const frame = await captureDisplayFrame();
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          runnerId: runner.id,
          source: runner.session,
          dataUrl: frame.dataUrl
        })
      });
      const result = (await response.json()) as {
        ok: boolean;
        stderr?: string;
        evidence?: {
          name: string;
          hostPath: string;
          wslPath: string;
          bytes: number;
          mime: string;
        };
      };
      if (!response.ok || result.ok === false || !result.evidence) {
        throw new Error(result.stderr || "Snapshot save failed.");
      }

      const saved = result.evidence;
      const evidenceItem: Evidence = {
        id: `${saved.name}-${Date.now()}`,
        name: saved.name,
        kind: "image",
        size: `${frame.width}x${frame.height}`,
        source: runner.session,
        path: saved.hostPath,
        wslPath: saved.wslPath
      };
      const replyDraft = snapshotReply(runner, task, saved.hostPath, saved.wslPath);
      setEvidence((current) => [evidenceItem, ...current].slice(0, 8));
      setSelectedEvidenceId(evidenceItem.id);
      const snapshotDecision: DecisionItem = {
        id: `snapshot-${runner.session}-${Date.now()}`,
        source: `${runner.session} snapshot`,
        title: "Conversation snapshot review",
        prompt: `Review the captured ${runner.session} conversation screen before the next agent step.`,
        options: ["Send to other agent", "Need OCR text", "Retake snapshot"],
        selected: "Send to other agent",
        note: `Snapshot saved at ${saved.wslPath}`,
        replyDraft,
        status: "open"
      };
      setDecisions((current) => [
        snapshotDecision,
        ...current
      ].slice(0, 12));
      setLastRunnerOutput(`Snapshot saved.\nWindows: ${saved.hostPath}\nWSL: ${saved.wslPath}`);
      await refresh(activeProject);
    } catch (error) {
      setLastRunnerOutput(`Snapshot failed: ${String(error)}`);
    } finally {
      setBusyRunner(null);
    }
  }

  function addEvidence(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const kind = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext || "")
          ? "video"
          : "log";
      return {
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        kind,
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined
      } satisfies Evidence;
    });
    setEvidence((current) => [...next, ...current].slice(0, 8));
    setSelectedEvidenceId(next[0]?.id || selectedEvidenceId);
  }

  function buildEvidenceHandoff(item = selectedEvidence) {
    if (!item) return;
    const replyDraft = evidenceHandoffText(item, task);
    const evidenceDecision: DecisionItem = {
      id: `evidence-${item.id}-${Date.now()}`,
      source: item.source ? `${item.source} evidence` : "Evidence tray",
      title: `Review evidence: ${item.name}`,
      prompt: `Review ${item.name} before the next agent step.`,
      options: ["Send to other agent", "Need OCR text", "Need more evidence"],
      selected: "Send to other agent",
      note: item.wslPath || item.path || "Local browser file selected.",
      replyDraft,
      status: "open"
    };
    setDecisions((current) => [evidenceDecision, ...current].slice(0, 12));
    setLastRunnerOutput(`Evidence handoff drafted for ${item.name}.`);
  }

  function captureDecisions(output: string, runner: Runner) {
    const lines = output
      .split(/\r?\n/)
      .map(cleanCaptureLine)
      .filter((line) => line.length > 1);
    const found: DecisionItem[] = [];

    for (let index = 0; index < lines.length && found.length < 4; index += 1) {
      const line = lines[index];
      if (!looksLikeQuestion(line)) continue;
      const options = lines
        .slice(index + 1, index + 7)
        .map(extractOption)
        .filter((option, optionIndex, all) => option && all.indexOf(option) === optionIndex)
        .slice(0, 4);
      found.push({
        id: `capture-${runner.session}-${Date.now()}-${found.length}`,
        source: runner.session,
        title: makeDecisionTitle(line),
        prompt: line,
        options: options.length >= 2 ? options : ["Proceed", "Hold", "Ask both agents"],
        selected: options[0] || "Proceed",
        note: "",
        replyDraft: "",
        status: "open"
      });
    }

    const existing = new Set(decisions.map((item) => `${item.source}:${item.prompt}`.toLowerCase()));
    const incoming = found.filter((item) => {
      const key = `${item.source}:${item.prompt}`.toLowerCase();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    if (!incoming.length) return 0;

    setDecisions((current) => {
      const seen = new Set(current.map((item) => `${item.source}:${item.prompt}`.toLowerCase()));
      const next = incoming.filter((item) => {
        const key = `${item.source}:${item.prompt}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return next.length ? [...next, ...current].slice(0, 12) : current;
    });
    return incoming.length;
  }

  function updateDecision(id: string, patch: Partial<DecisionItem>) {
    setDecisions((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addDecision() {
    const value = decisionDraft.trim();
    if (!value) return;
    const title = value.length > 52 ? `${value.slice(0, 49)}...` : value;
    setDecisions((current) => [
      {
        id: `decision-${Date.now()}`,
        source: "You",
        title,
        prompt: value,
        options: ["Proceed", "Hold", "Ask both agents"],
        selected: "Proceed",
        note: "",
        replyDraft: "",
        status: "open"
      },
      ...current
    ]);
    setDecisionDraft("");
  }

  function decisionText(decision: DecisionItem) {
    const draft = decision.replyDraft.trim();
    if (draft) return draft;
    return [
      `Decision: ${decision.title}`,
      `Answer: ${decision.selected}`,
      decision.note ? `Context: ${decision.note}` : "",
      `Task: ${task}`,
      "Continue from this decision. If blocked, ask one concise follow-up question with explicit options."
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function copyDecisionReply(decision: DecisionItem) {
    const text = decisionText(decision);
    try {
      await copyTextToClipboard(text);
      setCopiedDecision(decision.id);
      window.setTimeout(() => setCopiedDecision((current) => (current === decision.id ? "" : current)), 1400);
    } catch (error) {
      setLastRunnerOutput(`Copy failed: ${String(error)}`);
    }
  }

  async function copySetupCommand(id: string, text: string) {
    try {
      await copyTextToClipboard(text);
      setCopiedSetup(id);
      window.setTimeout(() => setCopiedSetup((current) => (current === id ? "" : current)), 1400);
    } catch (error) {
      setLastRunnerOutput(`Copy failed: ${String(error)}`);
    }
  }

  async function copySessionBrief() {
    const text = buildSessionBrief({
      sessionKey,
      projectName: activeProject?.name || "Unknown project",
      writerName: writerRunner?.name || "",
      task,
      runners,
      decisions,
      evidence,
      git
    });
    try {
      await copyTextToClipboard(text);
      setCopiedSessionBrief(true);
      window.setTimeout(() => setCopiedSessionBrief(false), 1400);
    } catch (error) {
      setLastRunnerOutput(`Copy failed: ${String(error)}`);
    }
  }

  async function postConfigAction(body: Record<string, unknown>, preferredProjectId = activeProject?.id || "") {
    setConfigBusy(String(body.action || "config"));
    setLastRunnerOutput("");
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = (await response.json()) as ConfigContext & { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || "Config update failed.");
      const [projectData, configData] = await Promise.all([
        getJson<{ projects: Project[] }>("/api/projects"),
        getJson<ConfigContext>("/api/config")
      ]);
      setProjects(projectData.projects);
      setConfig(configData);
      const nextProject =
        projectData.projects.find((project) => project.id === preferredProjectId) ||
        projectData.projects.find((project) => project.id === activeProject?.id) ||
        projectData.projects[0];
      setProjectId(nextProject?.id || "");
      if (nextProject) {
        await refresh(nextProject);
      } else {
        setGit(null);
        setRunners([]);
      }
      setLastRunnerOutput(`Config updated: ${body.action}`);
    } catch (error) {
      setLastRunnerOutput(`Config update failed: ${String(error)}`);
    } finally {
      setConfigBusy("");
    }
  }

  async function addProjectConfig() {
    const name = newProjectName.trim();
    const path = newProjectPath.trim();
    if (!name || !path) {
      setLastRunnerOutput("Project name and path are required.");
      return;
    }
    const id = clientId(name, "project");
    await postConfigAction({ action: "add-project", id, name, path }, id);
    setNewProjectName("");
    setNewProjectPath("");
  }

  async function deleteProjectConfig() {
    if (!activeProject) return;
    const ok = window.confirm(`Remove ${activeProject.name} from RelayDesk config? This will not delete the project folder.`);
    if (!ok) return;
    const fallback = projects.find((project) => project.id !== activeProject.id)?.id || "";
    await postConfigAction({ action: "delete-project", projectId: activeProject.id }, fallback);
  }

  async function addRunnerConfig() {
    if (!activeProject) return;
    const session = (runnerSession || runnerPreset.session).trim();
    const cwd = (runnerCwd || runnerPreset.cwd).trim();
    const startCommand = (runnerStartCommand || runnerPreset.startCommand).trim();
    await postConfigAction(
      {
        action: "add-runner",
        projectId: activeProject.id,
        runnerType,
        runnerId: runnerPreset.id,
        name: runnerPreset.name,
        session,
        cwd,
        startCommand,
        mode: "wsl",
        dismissCodexUpdatePrompt: runnerType === "codex-cli"
      },
      activeProject.id
    );
    setRunnerSession("");
    setRunnerCwd("");
    setRunnerStartCommand("");
  }

  async function deleteRunnerConfig(runner: ConfigRunner) {
    if (!activeProject) return;
    const ok = window.confirm(`Remove ${runner.session} from RelayDesk config? This will not kill a running tmux session.`);
    if (!ok) return;
    await postConfigAction({ action: "delete-runner", projectId: activeProject.id, runnerId: runner.id }, activeProject.id);
  }

  async function sendCliCommand(value = slashCommand) {
    const command = value.trim();
    if (!command) return;
    if (!commandRunner) {
      setLastRunnerOutput("No runner is configured for this project.");
      return;
    }
    if (commandRunner.state !== "running") {
      setLastRunnerOutput(`Start ${commandRunner.session} before sending CLI commands.`);
      return;
    }
    setSlashCommand(command);
    await runRunner(commandRunner, "send", {
      text: command,
      confirmMessage: `Send "${command}" to ${commandRunner.session}? Make sure the agent is waiting at its prompt.`
    });
  }

  if (bootError) return <div className="loading-shell error">{bootError}</div>;
  if (!projects.length) return <AppShellSkeleton />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Workflow size={18} />
          </div>
          <div>
            <strong>RelayDesk</strong>
            <span>Local agent cockpit</span>
          </div>
        </div>

        <section className="side-section">
          <div className="section-label">Projects</div>
          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={cx("project-row", project.id === activeProject?.id && "active")}
                onClick={() => setProjectId(project.id)}
              >
                <FolderGit2 size={16} />
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.runnerCount} runner{project.runnerCount === 1 ? "" : "s"}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="side-section">
          <div className="section-label">Runner Health</div>
          {runners.length ? (
            runners.map((runner) => (
              <div className="runner-mini" key={runner.id}>
                <RunnerDot state={runner.state} />
                <span>{runner.session}</span>
                <small>{runner.state}</small>
              </div>
            ))
          ) : (
            <div className="empty-note">No runners configured.</div>
          )}
        </section>

        <section className="side-section risk-box">
          <ShieldCheck size={16} />
          <div>
            <strong>Single writer policy</strong>
            <p>Only one agent should hold write permission during Build.</p>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="eyeline">Workspace</div>
            <h1>{activeProject?.name}</h1>
          </div>
          <div className="status-cluster">
            <span className={cx("status-pill", git?.clean ? "safe" : "warn")}>
              {git?.clean ? "git clean" : "dirty worktree"}
            </span>
            <span className="status-pill">
              <GitBranch size={13} />
              {git?.branch || "unknown"}
            </span>
          </div>
        </header>

        <section className="trust-bar">
          <div className="trust-intro">
            <div className="section-label">Agent Trust Bar</div>
            <h2>Verify agent claims against disk</h2>
            <p>Choose the active writer, then compare every agent claim with git and local runner activity.</p>
          </div>

          <div className="writer-lock">
            <div className="trust-mini-label">Active writer</div>
            <div className="writer-toggle" role="group" aria-label="Active writer">
              {runners.map((runner) => (
                <button
                  key={`writer-${runner.id}`}
                  className={cx(writerRunner?.id === runner.id && "active")}
                  onClick={() => setWriterRunnerId(runner.id)}
                >
                  <RunnerDot state={runner.state} />
                  {shortRunnerName(runner.name)}
                </button>
              ))}
              {!runners.length && <span>No runners</span>}
            </div>
          </div>

          <div className={cx("disk-verify", git?.clean ? "safe" : "warn")}>
            <div>
              <span>Disk verify</span>
              <strong>
                {!git
                  ? "Loading disk state"
                  : git.clean
                    ? "No disk changes"
                    : `${diskChangeCount || "Dirty"} file${diskChangeCount === 1 ? "" : "s"} changed`}
              </strong>
            </div>
            <small>
              {!git
                ? "Waiting for git context."
                : git.clean
                  ? "Claims still need review before merge."
                  : "Review git status before trusting agent output."}
            </small>
          </div>

          <div className="trust-agent-grid">
            {runners.slice(0, 2).map((runner) => {
              const row = usageByRunner.get(runner.id);
              return (
                <article className={cx("trust-agent", writerRunner?.id === runner.id && "writer")} key={`trust-${runner.id}`}>
                  <div className="trust-agent-head">
                    <div>
                      <strong>{shortRunnerName(runner.name)}</strong>
                      <span>{runner.session}</span>
                    </div>
                    <div className="trust-agent-state">
                      {writerRunner?.id === runner.id && <em>writer</em>}
                      <RunnerDot state={runner.state} />
                    </div>
                  </div>
                  <div className="trust-metrics">
                    <span>
                      <strong>{compactNumber(row?.sends ?? 0)}</strong>
                      <small>sends</small>
                    </span>
                    <span>
                      <strong>{compactNumber(row?.captures ?? 0)}</strong>
                      <small>captures</small>
                    </span>
                    <span>
                      <strong>{compactNumber(row?.snapshots ?? 0)}</strong>
                      <small>snapshots</small>
                    </span>
                  </div>
                  <p>{row ? `${row.lastAction || "idle"} at ${formatTime(row.lastAt)}` : "No local activity yet"}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="session-registry">
          <div className="session-registry-main">
            <div className="section-label">Session Registry</div>
            <h2>{activeSession?.title || sessionKey}</h2>
            <p>
              {activeProject?.name} / {writerRunner ? shortRunnerName(writerRunner.name) : "No writer"} / saved{" "}
              {formatTime(sessionLastSavedAt || activeSession?.updatedAt || sessionStartedAt)}
            </p>
            <div className="session-picker-row">
              <select
                value={activeSessionId}
                disabled={!visibleSessions.length || !!sessionBusy}
                onChange={(event) => void selectSession(event.target.value)}
              >
                {!visibleSessions.length && <option value="">No saved sessions</option>}
                {visibleSessions.map((session) => (
                  <option value={session.id} key={session.id}>
                    {session.status === "archived" ? "[archived] " : ""}
                    {session.title}
                  </option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={showArchivedSessions}
                  onChange={(event) => setShowArchivedSessions(event.target.checked)}
                />
                archived
              </label>
            </div>
          </div>
          <div className="session-registry-stats">
            <span>
              <strong>{sessions.filter((session) => session.status === "active").length}</strong>
              sessions
            </span>
            <span>
              <strong>{decisionCounts.open}</strong>
              open decisions
            </span>
            <span>
              <strong>{evidence.length}</strong>
              evidence
            </span>
          </div>
          <div className="session-registry-actions">
            <button disabled={!!sessionBusy} onClick={() => void createSession()}>
              <Plus size={13} />
              New
            </button>
            <button disabled={!!sessionBusy || !activeSession || activeSession.status === "archived"} onClick={() => void archiveSession()}>
              <Archive size={13} />
              Archive
            </button>
            <button disabled={!!sessionBusy || !activeSession} onClick={() => void deleteSession()}>
              <Trash2 size={13} />
              Delete
            </button>
            <button disabled={!!sessionBusy} onClick={() => void copySessionBrief()}>
              <Copy size={13} />
              {copiedSessionBrief ? "Copied" : "Copy brief"}
            </button>
          </div>
        </section>

        <nav className="stepper">
          {steps.map((step, index) => (
            <button
              key={step}
              className={cx("step", step === activeStep && "active", steps.indexOf(activeStep) > index && "done")}
              onClick={() => setActiveStep(step)}
            >
              <span>{index + 1}</span>
              {step}
            </button>
          ))}
        </nav>

        <div className="main-grid">
          <section className="task-panel">
            <div className="panel-head">
              <div>
                <div className="section-label">Current Task</div>
                <h2>Opener screenshot upload failure</h2>
              </div>
              <button className="ghost-button" onClick={() => void refresh()}>
                <RefreshCcw size={14} />
                Refresh
              </button>
            </div>
            <textarea value={task} onChange={(event) => setTask(event.target.value)} />
            <div className="agent-lanes">
              <article>
                <div className="lane-title">
                  <Bot size={15} />
                  Claude Code
                </div>
                <p>Lead builder for product flow, Flutter UI, and first-line dogfood bugs.</p>
                <span className="lane-mode">Plan mode</span>
              </article>
              <article>
                <div className="lane-title">
                  <Bot size={15} />
                  Codex
                </div>
                <p>Read-only reviewer for git diff, risk zones, and root-cause checks.</p>
                <span className="lane-mode">Review mode</span>
              </article>
            </div>
          </section>

          <section className="consensus-panel">
            <div className="panel-head">
              <div>
                <div className="section-label">Consensus</div>
                <h2>Decision Ledger</h2>
              </div>
              <span className="verdict">SAFE_TO_PATCH</span>
            </div>
            <div className="ledger">
              <div>
                <strong>Agreement</strong>
                <p>Start with image picker permission, compressed file path, and opener request boundary.</p>
              </div>
              <div>
                <strong>Missing Evidence</strong>
                <p>Need device log and failing screenshot/video before changing quota or OCR code.</p>
              </div>
              <div>
                <strong>Next Move</strong>
                <p>Run Discuss, then assign one builder. Reviewer reads git diff after targeted fix.</p>
              </div>
            </div>
          </section>
        </div>

        <section className="session-console">
          <div className="console-head">
            <div>
              <div className="section-label">Session Console</div>
              <h2>Live tmux pane</h2>
            </div>
            <div className="console-tools">
              <select
                className="console-runner-select"
                value={commandRunner?.id || ""}
                disabled={!runners.length}
                onChange={(event) => setCommandRunnerId(event.target.value)}
              >
                {runners.map((runner) => (
                  <option value={runner.id} key={runner.id}>
                    {runner.session}
                  </option>
                ))}
              </select>
              <button disabled={!!busyRunner || commandRunner?.state !== "running"} onClick={() => void captureConsole(commandRunner, { mode: "capture" })}>
                <FileDiff size={13} />
                Capture Pane
              </button>
              <button
                className={cx(consoleAutoRefresh && "active")}
                disabled={!commandRunner || commandRunner.state !== "running"}
                onClick={() => setConsoleAutoRefresh((current) => !current)}
              >
                <RefreshCcw size={13} />
                Auto refresh {consoleAutoRefresh ? "on" : "off"}
              </button>
              <button disabled={!!busyRunner || commandRunner?.state !== "running"} onClick={() => commandRunner && void runRunner(commandRunner, "open")}>
                <Terminal size={13} />
                Open
              </button>
            </div>
          </div>
          <div className="console-meta">
            <span>
              <RunnerDot state={commandRunner?.state || "unconfigured"} />
              {commandRunner ? `${commandRunner.name} / ${commandRunner.session}` : "No runner"}
            </span>
            <span>{consoleLastCaptureAt ? `Last pane read ${consoleLastCaptureAt}` : "No pane read yet"}</span>
          </div>
          <pre className="console-output">{consoleOutput || "Live tmux output appears here."}</pre>
          <div className="console-command-bar">
            <input
              value={consoleInput}
              onChange={(event) => setConsoleInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendConsoleInput();
              }}
              placeholder="Type a task, decision reply, /help, /clear, /compact..."
            />
            <button disabled={!!busyRunner || commandRunner?.state !== "running" || !consoleInput.trim()} onClick={() => void sendConsoleInput()}>
              <Send size={13} />
              Send
            </button>
          </div>
          <div className="console-presets">
            {slashCommandPresets.map((preset) => (
              <button
                key={`console-${preset.id}`}
                disabled={!!busyRunner || commandRunner?.state !== "running"}
                title={preset.hint}
                onClick={() => void sendConsoleInput(preset.command)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="decision-inbox">
          <div className="tray-head">
            <div>
              <div className="section-label">Decision Inbox</div>
              <h2>Open calls</h2>
            </div>
            <div className="decision-compose">
              <input
                value={decisionDraft}
                onChange={(event) => setDecisionDraft(event.target.value)}
                placeholder="Add a question or decision..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") addDecision();
                }}
              />
              <button disabled={!decisionDraft.trim()} onClick={addDecision}>
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>
          <div className="decision-list">
            {decisions.map((decision) => (
              <article className={cx("decision-card", decision.status === "sent" && "sent")} key={decision.id}>
                <div className="decision-card-head">
                  <div>
                    <span className="decision-source">
                      <Inbox size={13} />
                      {decision.source}
                    </span>
                    <strong>{decision.title}</strong>
                  </div>
                  <span className={cx("decision-state", decision.status)}>
                    {decision.status === "sent" ? <Check size={13} /> : <CircleDot size={13} />}
                    {decision.status}
                  </span>
                </div>
                <p className="decision-prompt">{decision.prompt}</p>
                <div className="decision-options">
                  {decision.options.map((option) => (
                    <button
                      key={option}
                      className={cx("decision-option", decision.selected === option && "active")}
                      onClick={() => updateDecision(decision.id, { selected: option, replyDraft: "", status: "open" })}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <textarea
                  className="decision-note"
                  value={decision.note}
                  onChange={(event) => updateDecision(decision.id, { note: event.target.value, status: "open" })}
                  placeholder="Decision context..."
                />
                <div className="reply-draft-box">
                  <div className="reply-draft-head">
                    <span>Cross-agent reply</span>
                    <div>
                      <button onClick={() => updateDecision(decision.id, { replyDraft: buildAgentReply(decision, task), status: "open" })}>
                        Ask reviewer
                      </button>
                      <button onClick={() => updateDecision(decision.id, { replyDraft: buildReturnVerdict(decision, task), status: "open" })}>
                        Return verdict
                      </button>
                      <button onClick={() => void copyDecisionReply(decision)}>
                        <Copy size={13} />
                        {copiedDecision === decision.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="reply-draft"
                    value={decision.replyDraft}
                    onChange={(event) => updateDecision(decision.id, { replyDraft: event.target.value, status: "open" })}
                    placeholder="Paste or build the exact reply you want to send to the other agent..."
                  />
                </div>
                <div className="decision-footer">
                  <small>{decision.replyDraft.trim() ? "custom reply draft" : decision.selected}</small>
                  <div className="decision-actions">
                    {runners.map((runner) => (
                      <button
                        key={`${decision.id}-${runner.id}`}
                        disabled={!!busyRunner || runner.state !== "running"}
                        onClick={() =>
                          void runRunner(runner, "send", {
                            text: decisionText(decision),
                            confirmMessage: `Send this decision to ${runner.session}?`,
                            onSuccess: () => updateDecision(decision.id, { status: "sent" })
                          })
                        }
                      >
                        <Send size={13} />
                        Send to {runner.session}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="evidence-tray">
          <div className="tray-head">
            <div>
              <div className="section-label">Evidence</div>
              <h2>Bug material attached to this task</h2>
            </div>
            <label className="upload-button">
              <Upload size={14} />
              Add files
              <input type="file" multiple onChange={(event) => addEvidence(event.target.files)} />
            </label>
          </div>
          <div className="evidence-list">
            {evidence.map((item) => (
              <button
                className={cx("evidence-card", selectedEvidence?.id === item.id && "active")}
                key={item.id}
                onClick={() => setSelectedEvidenceId(item.id)}
              >
                <div className={cx("evidence-icon", item.kind)}>
                  {item.kind === "image" ? <Image size={18} /> : item.kind === "video" ? <Play size={18} /> : <FileDiff size={18} />}
                </div>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.source ? `${item.source} - ` : ""}{item.kind} - {item.size}</span>
                </div>
              </button>
            ))}
          </div>
          {selectedEvidence && (
            <div className="evidence-preview">
              <div className="evidence-preview-head">
                <div>
                  <strong>{selectedEvidence.name}</strong>
                  <span>{selectedEvidence.source || "Local evidence"} / {selectedEvidence.kind}</span>
                </div>
                <button onClick={() => buildEvidenceHandoff(selectedEvidence)}>
                  <Send size={13} />
                  Build handoff
                </button>
              </div>
              <div className="evidence-preview-body">
                {selectedEvidence.kind === "image" && selectedEvidencePreview ? (
                  <img src={selectedEvidencePreview} alt={selectedEvidence.name} />
                ) : selectedEvidence.kind === "video" && selectedEvidencePreview ? (
                  <video src={selectedEvidencePreview} controls />
                ) : (
                  <div className="evidence-preview-empty">
                    <FileDiff size={18} />
                    <span>Preview is not available for this evidence type.</span>
                  </div>
                )}
              </div>
              <div className="evidence-paths">
                {selectedEvidence.path && <span>Windows: {selectedEvidence.path}</span>}
                {selectedEvidence.wslPath && <span>WSL: {selectedEvidence.wslPath}</span>}
                {!selectedEvidence.path && !selectedEvidence.wslPath && <span>Browser-local file. Build handoff will ask the other agent for OCR or a focused snapshot if needed.</span>}
              </div>
            </div>
          )}
        </section>
      </section>

      <aside className="ops-panel">
        <section className="ops-card">
          <div className="panel-head">
            <div>
              <div className="section-label">Git Review</div>
              <h2>Diff state</h2>
            </div>
            {git?.clean ? <CheckCircle2 className="ok" size={18} /> : <FileDiff className="warn-icon" size={18} />}
          </div>
          <div className="git-box">
            <strong>Status</strong>
            <pre>{git?.status || "clean"}</pre>
          </div>
          <div className="git-box">
            <strong>Diff stat</strong>
            <pre>{git?.diffStat || "no unstaged diff"}</pre>
          </div>
        </section>

        <section className="ops-card setup-card">
          <div className="panel-head">
            <div>
              <div className="section-label">{setup.label}</div>
              <h2>{setup.title}</h2>
            </div>
            <div className="language-switch" aria-label="Language">
              <button className={cx(lang === "en" && "active")} onClick={() => setLang("en")}>
                <Globe2 size={12} />
                EN
              </button>
              <button className={cx(lang === "zh-TW" && "active")} onClick={() => setLang("zh-TW")}>
                繁中
              </button>
            </div>
          </div>
          <p className="setup-subtitle">{setup.subtitle}</p>
          <div className="setup-list">
            {setupRows.map((row) => (
              <div className={cx("setup-row", row.status)} key={row.id}>
                <span>{row.status === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}</span>
                <div>
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="compat-box">
            <div className="compat-head">
              <ListChecks size={14} />
              <strong>{setup.compat}</strong>
            </div>
            <div className="compat-grid">
              <div>
                <span>Node</span>
                <strong>{doctor?.node || "unknown"}</strong>
              </div>
              <div>
                <span>OS</span>
                <strong>{doctor?.platform || "unknown"}</strong>
              </div>
              <div>
                <span>Claude</span>
                <strong>{doctorById.get("wsl-claude")?.detail?.split("\n").pop() || "not checked"}</strong>
              </div>
              <div>
                <span>Codex</span>
                <strong>{doctorById.get("wsl-codex")?.detail?.split("\n").pop() || "not checked"}</strong>
              </div>
            </div>
          </div>
          <div className="setup-actions">
            <button onClick={() => void copySetupCommand("install", setup.commands.install)}>
              <Copy size={13} />
              {copiedSetup === "install" ? setup.copied : setup.install}
            </button>
            <button onClick={() => void copySetupCommand("config", setup.commands.config)}>
              <Copy size={13} />
              {copiedSetup === "config" ? setup.copied : setup.config}
            </button>
            <button onClick={() => void copySetupCommand("run", setup.commands.run)}>
              <BookOpen size={13} />
              {copiedSetup === "run" ? setup.copied : setup.run}
            </button>
          </div>
          <div className="docs-link">{setup.docs}: README.md, README.zh-TW.md, docs/getting-started.md</div>
        </section>

        <section className="ops-card config-manager">
          <div className="panel-head">
            <div>
              <div className="section-label">Project Manager</div>
              <h2>Projects & sessions</h2>
            </div>
            <Settings2 size={17} />
          </div>
          <div className="config-source">
            <span>{config?.source.kind || "config"}</span>
            <strong>{config?.source.path || "relay.local.json"}</strong>
          </div>

          <div className="config-block">
            <div className="config-block-head">
              <strong>Add project</strong>
              <span>Writes to relay.local.json</span>
            </div>
            <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name" />
            <input value={newProjectPath} onChange={(event) => setNewProjectPath(event.target.value)} placeholder="C:\\path\\to\\project" />
            <button disabled={!!configBusy || !newProjectName.trim() || !newProjectPath.trim()} onClick={() => void addProjectConfig()}>
              <Plus size={13} />
              Add Project
            </button>
          </div>

          <div className="config-block">
            <div className="config-block-head">
              <strong>{activeProject?.name || "No project"}</strong>
              <span>{activeProject?.path || "Select a project"}</span>
            </div>
            <button className="danger-action" disabled={!!configBusy || projects.length <= 1 || !activeProject} onClick={() => void deleteProjectConfig()}>
              <Trash2 size={13} />
              Remove selected project
            </button>
          </div>

          <div className="config-block">
            <div className="config-block-head">
              <strong>Add runner session</strong>
              <span>Session config only; Start controls tmux.</span>
            </div>
            <select value={runnerType} onChange={(event) => setRunnerType(event.target.value)}>
              <option value="claude-code">Claude Code tmux</option>
              <option value="codex-cli">Codex CLI tmux</option>
              <option value="custom">Custom tmux</option>
            </select>
            <input value={runnerSession} onChange={(event) => setRunnerSession(event.target.value)} placeholder={runnerPreset.session} />
            <input value={runnerCwd} onChange={(event) => setRunnerCwd(event.target.value)} placeholder={runnerPreset.cwd || "tmux cwd"} />
            <textarea
              value={runnerStartCommand}
              onChange={(event) => setRunnerStartCommand(event.target.value)}
              placeholder={runnerPreset.startCommand}
            />
            <button disabled={!!configBusy || !activeProject} onClick={() => void addRunnerConfig()}>
              <Plus size={13} />
              Add Runner
            </button>
          </div>

          <div className="runner-config-list">
            {(activeConfigProject?.runners || []).map((runner) => (
              <div className="runner-config-row" key={runner.id}>
                <div>
                  <strong>{runner.name}</strong>
                  <span>{runner.session}</span>
                </div>
                <button disabled={!!configBusy} onClick={() => void deleteRunnerConfig(runner)} title={`Remove ${runner.session}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {!(activeConfigProject?.runners || []).length && <div className="empty-note">No runner sessions configured.</div>}
          </div>
        </section>

        <section className="ops-card">
          <div className="panel-head">
            <div>
              <div className="section-label">Readiness</div>
              <h2>Doctor checks</h2>
            </div>
            {doctor?.summary.fail ? <AlertTriangle className="warn-icon" size={18} /> : <CheckCircle2 className="ok" size={18} />}
          </div>
          <div className="doctor-summary">
            <span className="ok">{doctor?.summary.ok ?? 0} ok</span>
            <span className={cx((doctor?.summary.warn ?? 0) > 0 && "warn-text")}>{doctor?.summary.warn ?? 0} warn</span>
            <span className={cx((doctor?.summary.fail ?? 0) > 0 && "danger-text")}>{doctor?.summary.fail ?? 0} fail</span>
          </div>
          <div className="doctor-list">
            {visibleDoctorChecks.map((item) => (
              <div className={cx("doctor-row", item.status)} key={item.id}>
                <span>{item.status === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail || item.fix || "No details."}</small>
                </div>
              </div>
            ))}
            {!visibleDoctorChecks.length && <div className="empty-note">Run refresh to load doctor checks.</div>}
          </div>
        </section>

        <section className="ops-card usage-card">
          <div className="panel-head">
            <div>
              <div className="section-label">Usage / Activity</div>
              <h2>Local relay traffic</h2>
            </div>
            <Activity size={17} />
          </div>
          <div className="usage-grid">
            <div>
              <strong>{compactNumber(usage?.totals.sends ?? 0)}</strong>
              <span>sends</span>
            </div>
            <div>
              <strong>{compactNumber(usage?.totals.captures ?? 0)}</strong>
              <span>captures</span>
            </div>
            <div>
              <strong>{compactNumber(usage?.totals.snapshots ?? 0)}</strong>
              <span>snapshots</span>
            </div>
            <div>
              <strong>{formatBytes(usage?.totals.evidenceBytes ?? 0)}</strong>
              <span>evidence</span>
            </div>
          </div>
          <div className="usage-list">
            {(usage?.runners || [])
              .filter((row) => row.projectId === activeProject?.id)
              .slice(0, 4)
              .map((row) => (
                <div className="usage-row" key={row.key}>
                  <div>
                    <strong>{row.runnerName}</strong>
                    <small>{row.lastAction || "idle"} at {formatTime(row.lastAt)}</small>
                  </div>
                  <span>{row.sends} sent / {row.captures} cap / {row.snapshots} snap</span>
                </div>
              ))}
            {!(usage?.runners || []).some((row) => row.projectId === activeProject?.id) && (
              <div className="empty-note">No local relay activity yet.</div>
            )}
          </div>
          <p className="usage-note">Tracks local actions only. It does not estimate model billing or provider tokens.</p>
        </section>

        <section className="ops-card">
          <div className="panel-head">
            <div>
              <div className="section-label">Runner Ops</div>
              <h2>tmux controls</h2>
            </div>
            <Power size={17} />
          </div>
          <div className="runner-stack">
            {runners.map((runner) => (
              <div className="runner-card" key={runner.id}>
                <div className="runner-card-head">
                  <div>
                    <strong>{runner.name}</strong>
                    <span>{runner.session}</span>
                  </div>
                  <RunnerDot state={runner.state} />
                </div>
                <div className="runner-actions">
                  <button disabled={!!busyRunner || runner.state === "running"} onClick={() => void runRunner(runner, "start")}>
                    <Play size={13} />
                    Start
                  </button>
                  <button disabled={!!busyRunner || runner.state !== "running"} onClick={() => void runRunner(runner, "stop")}>
                    <Square size={13} />
                    Stop
                  </button>
                  <button disabled={!!busyRunner} onClick={() => void runRunner(runner, "restart")}>
                    <RefreshCcw size={13} />
                    Restart
                  </button>
                  <button disabled={!!busyRunner || runner.state !== "running"} onClick={() => void runRunner(runner, "capture")}>
                    <FileDiff size={13} />
                    Capture
                  </button>
                  <button disabled={!!busyRunner} onClick={() => void snapshotRunner(runner)}>
                    <Camera size={13} />
                    Snapshot
                  </button>
                  <button disabled={!!busyRunner || runner.state !== "running"} onClick={() => void runRunner(runner, "send")}>
                    <Send size={13} />
                    Send Task
                  </button>
                  <button className="wide-action" disabled={!!busyRunner || runner.state !== "running"} onClick={() => void runRunner(runner, "open")}>
                    <Terminal size={13} />
                    Open Terminal
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="slash-panel">
            <div className="slash-head">
              <div>
                <strong>Slash command</strong>
                <span>Send directly into the live tmux prompt.</span>
              </div>
              <select value={commandRunner?.id || ""} onChange={(event) => setCommandRunnerId(event.target.value)}>
                {runners.map((runner) => (
                  <option value={runner.id} key={runner.id}>
                    {runner.session}
                  </option>
                ))}
              </select>
            </div>
            <div className="slash-presets">
              {slashCommandPresets.map((preset) => (
                <button
                  key={preset.id}
                  disabled={!!busyRunner || commandRunner?.state !== "running"}
                  title={preset.hint}
                  onClick={() => void sendCliCommand(preset.command)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="slash-input-row">
              <input
                value={slashCommand}
                onChange={(event) => setSlashCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void sendCliCommand();
                }}
                placeholder="/help, /clear, /compact..."
              />
              <button disabled={!!busyRunner || commandRunner?.state !== "running" || !slashCommand.trim()} onClick={() => void sendCliCommand()}>
                <Send size={13} />
                Send
              </button>
            </div>
            <p>Use Capture first if you are not sure the agent is waiting at an input prompt.</p>
          </div>
          <pre className="runner-output">{lastRunnerOutput || "Runner output appears here."}</pre>
        </section>
      </aside>
    </main>
  );
}
