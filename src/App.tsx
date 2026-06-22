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
import agentPresets from "../agent-presets.json";

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
    mode?: RunnerMode;
    cwd?: string;
    startCommand?: string;
    dismissCodexUpdatePrompt?: boolean;
  };
};

type RunnerMode = "wsl" | "native";

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

type AgentCliCandidate = {
  path: string;
  source: string;
  kind?: string;
  ok: boolean;
  version: string;
  supportsGpt55?: boolean;
  supportsEffort?: boolean;
  supportsStreamJson?: boolean;
  supportsOpus48?: boolean;
  supportsXhigh?: boolean;
  supportsMax?: boolean;
  output?: string;
  error?: string;
};

type AgentCliHealth = {
  selected?: AgentCliCandidate | null;
  pathDefault?: AgentCliCandidate | null;
  candidates?: AgentCliCandidate[];
  supportsEffort?: boolean;
  supportsStreamJson?: boolean;
  supportsOpus48?: boolean;
  supportsXhigh?: boolean;
  supportsMax?: boolean;
  execJson?: boolean;
  preferredModel?: string;
  preferredEffort?: string;
  minimumOpus48Version?: string;
};

type DoctorContext = {
  platform: string;
  node: string;
  agents?: {
    claude?: AgentCliHealth;
    codex?: AgentCliHealth;
  };
  summary: {
    ok: number;
    warn: number;
    fail: number;
    total: number;
  };
  checks: DoctorCheck[];
};

type OnboardingStatus = DoctorCheck["status"] | "missing";

type OnboardingSource = {
  id: string;
  label: string;
  agent: "shared" | "claude" | "codex" | "custom";
  kind: string;
  relative: string;
  path: string;
  exists: boolean;
  isDirectory: boolean;
  size?: number;
  entries?: string[];
  preview?: string;
  status: OnboardingStatus;
  detail: string;
};

type OnboardingHome = {
  agent: "claude" | "codex";
  scope: string;
  path: string;
  exists: boolean;
  items: OnboardingSource[];
};

type RunnerProfile = {
  id: string;
  name: string;
  session: string;
  agent: "claude" | "codex" | "custom";
  mode: RunnerMode;
  cwd: string;
  startCommand: string;
  status: DoctorCheck["status"];
  detail: string;
  contextSources: string[];
};

type ProjectOnboardingContext = {
  projectId: string;
  projectName: string;
  path: string;
  exists: boolean;
  summary: {
    ok: number;
    warn: number;
    fail: number;
    total: number;
  };
  checks: DoctorCheck[];
  contextSources: OnboardingSource[];
  agentHomes: OnboardingHome[];
  runnerProfiles: RunnerProfile[];
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
  sourceRunnerId?: string;
  reviewerRunnerId?: string;
  path?: string;
  wslPath?: string;
  previewUrl?: string;
  note?: string;
  capturedAt?: string;
};

type DecisionItem = {
  id: string;
  source: string;
  sourceRunnerId?: string;
  reviewerRunnerId?: string;
  title: string;
  prompt: string;
  options: string[];
  selected: string;
  note: string;
  replyDraft: string;
  status: "open" | "reviewing" | "reviewed" | "sent" | "returned";
  sentAt?: string;
  reviewedAt?: string;
  returnedAt?: string;
};

type RelayBusEventKind = "message" | "decision" | "review_request" | "ack" | "capture" | "verdict" | "consensus" | "snapshot";
type RelayBusEventStatus = "open" | "queued" | "sent" | "acked" | "captured" | "returned";

type RelayBusEvent = {
  id: string;
  at: string;
  kind: RelayBusEventKind;
  status: RelayBusEventStatus;
  title: string;
  summary: string;
  sourceRunnerId?: string;
  targetRunnerId?: string;
  sourceName?: string;
  targetName?: string;
  decisionId?: string;
  evidenceId?: string;
};

type RelayRouteContext = {
  sourceName?: string;
  reviewerName?: string;
};

type RelaySessionState = {
  activeStep: string;
  task: string;
  decisions: DecisionItem[];
  evidence: Evidence[];
  busEvents: RelayBusEvent[];
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

type SlashRisk = "safe" | "context" | "destructive" | "custom";

type SlashCommandPreset = {
  id: string;
  label: string;
  command: string;
  hint: string;
  risk: SlashRisk;
  captureDelayMs: number;
  aliases?: string[];
};

const steps = ["Discuss", "Synthesize", "Build", "Review", "Verify"];

const slashCommandPresets: SlashCommandPreset[] = [
  { id: "help", label: "/help", command: "/help", hint: "Show commands available in the selected CLI", risk: "safe", captureDelayMs: 650 },
  { id: "status", label: "/status", command: "/status", hint: "Read active CLI status and usage where supported", risk: "safe", captureDelayMs: 650 },
  { id: "compact", label: "/compact", command: "/compact", hint: "Summarize or rotate long context where supported", risk: "context", captureDelayMs: 1100 },
  { id: "resume", label: "/resume", command: "/resume", hint: "Resume a previous agent session where supported", risk: "context", captureDelayMs: 1100 },
  { id: "clear", label: "/clear", command: "/clear", hint: "Clear or restart conversation context, depending on the CLI", risk: "destructive", captureDelayMs: 1300 }
];

const slashRiskCopy: Record<SlashRisk, { label: string; description: string }> = {
  safe: {
    label: "Safe read",
    description: "Usually opens help, status, or another read-only CLI surface."
  },
  context: {
    label: "Context change",
    description: "May summarize, resume, or reshape the active agent context."
  },
  destructive: {
    label: "State reset",
    description: "Can clear, delete, exit, or start over in the live CLI session."
  },
  custom: {
    label: "Custom",
    description: "RelayDesk will pass it through exactly; behavior depends on your agent setup."
  }
};

const busEventCopy: Record<RelayBusEventKind, { label: string; icon: "send" | "check" | "file" | "workflow" }> = {
  message: { label: "Message", icon: "send" },
  decision: { label: "Decision", icon: "workflow" },
  review_request: { label: "Review request", icon: "send" },
  ack: { label: "ACK", icon: "check" },
  capture: { label: "Capture", icon: "file" },
  verdict: { label: "Verdict", icon: "send" },
  consensus: { label: "Consensus", icon: "check" },
  snapshot: { label: "Snapshot", icon: "file" }
};

function compactSummary(value: string, max = 180) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3)}...`;
}

function busEventIcon(kind: RelayBusEventKind) {
  const icon = busEventCopy[kind].icon;
  if (icon === "send") return <Send size={13} />;
  if (icon === "check") return <Check size={13} />;
  if (icon === "file") return <FileDiff size={13} />;
  return <Workflow size={13} />;
}

const contextSlashCommands = new Set(["/compact", "/resume", "/continue", "/handoff", "/round", "/recap", "/summarize", "/summary"]);
const destructiveSlashCommands = new Set(["/clear", "/new", "/delete", "/archive", "/quit", "/exit", "/logout", "/stop"]);
const safeSlashCommands = new Set(["/", "/help", "/status", "/usage", "/diff", "/doctor", "/context", "/cost", "/stats"]);

const doctorPriorityIds = [
  "runner-session-unique",
  "wsl-tmux-smoke",
  "tmux-smoke",
  "wsl-claude",
  "wsl-codex",
  "wsl-codex-gpt-55",
  "claude-selected-cli",
  "claude-stream-json",
  "claude-effort-mode",
  "claude-opus-48",
  "claude-ultra-code",
  "codex-selected-cli",
  "codex-gpt-55",
  "codex-json-events",
  "codex-path-shadow",
  "codex-service-tier",
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

type SetupText = {
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
  onboarding: {
    title: string;
    subtitle: string;
    ready: string;
    steps: Record<"config" | "project" | "runner" | "doctor" | "start", { label: string; detail: string }>;
    actions: Record<"config" | "project" | "runner" | "doctor" | "start", string>;
  };
};

const cleanSetupCopy: Record<Lang, SetupText> = {
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
    docs: "README + setup docs",
    onboarding: {
      title: "First-run checklist",
      subtitle: "Work from top to bottom. RelayDesk writes local config only; it never edits your project code.",
      ready: "Ready for a first agent run",
      steps: {
        config: { label: "Create local config", detail: "Use relay.local.json before real project work." },
        project: { label: "Add a real project path", detail: "Point RelayDesk at the folder you want agents to work in." },
        runner: { label: "Add at least one runner", detail: "Claude Code, Codex CLI, or a custom tmux session." },
        doctor: { label: "Run Doctor checks", detail: "Confirm git, tmux, paths, and agent CLIs are reachable." },
        start: { label: "Start a runner", detail: "Open the live tmux pane before sending tasks or slash commands." }
      },
      actions: {
        config: "Copy config",
        project: "Add project",
        runner: "Add runner",
        doctor: "Refresh",
        start: "Runner Ops"
      }
    }
  },
  "zh-TW": {
    label: "設定",
    title: "快速開始",
    subtitle: "先看 Doctor 結果，再複製需要的指令。",
    install: "安裝套件",
    config: "複製設定",
    run: "啟動程式",
    copied: "已複製",
    checks: {
      config: "本機設定已載入",
      paths: "專案路徑存在",
      terminal: "WSL/tmux 可用",
      agents: "Agent CLI 已找到"
    },
    commands: {
      install: "npm.cmd install",
      config: "Copy-Item relay.config.example.json relay.local.json",
      run: "npm.cmd run api\nnpm.cmd run dev"
    },
    compat: "相容性",
    docs: "README 與設定文件",
    onboarding: {
      title: "第一次使用 checklist",
      subtitle: "照順序完成即可。RelayDesk 只寫本機設定，不會改你的專案程式碼。",
      ready: "可以開始第一輪 agent 任務",
      steps: {
        config: { label: "建立本機設定", detail: "正式使用前請先有 relay.local.json。" },
        project: { label: "加入真實專案路徑", detail: "指向你要讓 agent 工作的資料夾。" },
        runner: { label: "至少加入一個 runner", detail: "Claude Code、Codex CLI，或自訂 tmux session。" },
        doctor: { label: "跑 Doctor 檢查", detail: "確認 git、tmux、路徑、agent CLI 都能連到。" },
        start: { label: "啟動 runner", detail: "先看到 live tmux pane，再送 task 或 slash command。" }
      },
      actions: {
        config: "複製設定",
        project: "加專案",
        runner: "加 runner",
        doctor: "重新整理",
        start: "Runner Ops"
      }
    }
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

function normalizeSlashCommand(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function slashCommandName(value: string) {
  const command = normalizeSlashCommand(value);
  return command.split(/\s+/)[0]?.toLowerCase() || "";
}

function slashCommandMeta(value: string): SlashCommandPreset {
  const name = slashCommandName(value);
  const preset = slashCommandPresets.find((item) => item.command === name || item.aliases?.includes(name));
  if (preset) return preset;
  if (destructiveSlashCommands.has(name)) {
    return {
      id: `dynamic-${name}`,
      label: name,
      command: name,
      hint: "State-changing CLI command",
      risk: "destructive",
      captureDelayMs: 1300
    };
  }
  if (contextSlashCommands.has(name)) {
    return {
      id: `dynamic-${name}`,
      label: name,
      command: name,
      hint: "Context-changing CLI command",
      risk: "context",
      captureDelayMs: 1100
    };
  }
  if (safeSlashCommands.has(name)) {
    return {
      id: `dynamic-${name}`,
      label: name,
      command: name,
      hint: "Read-only CLI command",
      risk: "safe",
      captureDelayMs: 650
    };
  }
  return {
    id: `custom-${clientId(name || "slash")}`,
    label: name || "/",
    command: name || "/",
    hint: "Custom slash command",
    risk: "custom",
    captureDelayMs: 900
  };
}

function formatSlashDelay(ms: number) {
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

function slashConfirmMessage(command: string, runner: Runner, meta: SlashCommandPreset) {
  const risk = slashRiskCopy[meta.risk];
  return [
    `Send "${command}" to ${runner.session}?`,
    "",
    `${risk.label}: ${risk.description}`,
    `RelayDesk will auto-peek the pane after ${formatSlashDelay(meta.captureDelayMs)}.`,
    "Confirm the agent is waiting at a prompt before sending."
  ].join("\n");
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

function buildAgentReply(decision: DecisionItem, task: string, route: RelayRouteContext = {}) {
  return [
    "Relay request for reviewer:",
    route.sourceName || route.reviewerName ? `Route: ${route.sourceName || "source"} -> ${route.reviewerName || "reviewer"} -> source` : "",
    `Source: ${decision.source}`,
    route.sourceName ? `Source runner: ${route.sourceName}` : "",
    route.reviewerName ? `Reviewer runner: ${route.reviewerName}` : "",
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

function buildReturnVerdict(decision: DecisionItem, task: string, route: RelayRouteContext = {}) {
  return [
    "Relay verdict back to source agent:",
    route.sourceName || route.reviewerName ? `Route: ${route.reviewerName || "reviewer"} -> ${route.sourceName || "source"}` : "",
    `Decision: ${decision.title}`,
    `我會選「${decision.selected}」。`,
    decision.note ? `Reason / reviewer note: ${decision.note}` : "",
    `Task: ${task}`,
    "Continue from this decision. Keep the patch minimal, avoid unrelated files, and stop to ask if the next step would touch a high-risk area."
  ]
    .filter(Boolean)
    .join("\n");
}

function snapshotReply(runner: Runner, task: string, hostPath: string, wslPath: string, note = "", route: RelayRouteContext = {}) {
  return [
    `Snapshot from ${runner.session}`,
    route.reviewerName ? `Reviewer runner: ${route.reviewerName}` : "",
    `Windows file: ${hostPath}`,
    `WSL file: ${wslPath}`,
    note ? `OCR / context: ${note}` : "",
    `Task: ${task}`,
    "Please do a second-pass check on this agent conversation snapshot.",
    "Focus on whether the source agent is blocked, asking for a decision, showing a risky command, or missing evidence.",
    "If you cannot inspect the image directly, ask me for OCR text or a cropped follow-up snapshot."
  ]
    .filter(Boolean)
    .join("\n");
}

function evidenceHandoffText(item: Evidence, task: string, route: RelayRouteContext = {}) {
  return [
    `Evidence handoff: ${item.name}`,
    route.sourceName || route.reviewerName ? `Route: ${route.sourceName || item.source || "evidence"} -> ${route.reviewerName || "reviewer"} -> source` : "",
    `Type: ${item.kind}`,
    item.source ? `Source: ${item.source}` : "",
    item.path ? `Windows file: ${item.path}` : "",
    item.wslPath ? `WSL file: ${item.wslPath}` : "",
    item.note ? `OCR / context: ${item.note}` : "",
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
  busEvents: RelayBusEvent[];
  git: GitContext | null;
}) {
  const openDecisions = input.decisions.filter((item) => item.status === "open").length;
  const relayDecisions = input.decisions.filter((item) => item.status === "reviewing" || item.status === "reviewed").length;
  const returnedDecisions = input.decisions.filter((item) => item.status === "returned").length;
  const ackEvents = input.busEvents.filter((item) => item.kind === "ack" || item.status === "acked").length;
  const consensusEvents = input.busEvents.filter((item) => item.kind === "consensus").length;
  return [
    `RelayDesk session: ${input.sessionKey}`,
    `Project: ${input.projectName}`,
    `Active writer: ${input.writerName || "unassigned"}`,
    `Task: ${input.task}`,
    `Git: ${input.git?.clean ? "clean" : "dirty or unknown"} (${input.git?.branch || "unknown branch"})`,
    `Runners: ${input.runners.map((runner) => `${runner.name}=${runner.state}`).join(", ") || "none"}`,
    `Decisions: ${openDecisions} open / ${relayDecisions} in relay / ${returnedDecisions} returned`,
    `Evidence: ${input.evidence.length} item${input.evidence.length === 1 ? "" : "s"}`,
    `Relay Bus: ${input.busEvents.length} events / ${ackEvents} ACK / ${consensusEvents} consensus`,
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

function runnerCwdForMode(path: string, mode: RunnerMode) {
  if (mode === "wsl") return toWslPathClient(path);
  return path.trim();
}

function windowsForwardPath(path: string) {
  return path.trim().replace(/\\/g, "/");
}

function doubleQuote(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function singleQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function runnerDefaults(project: Project | undefined, type: string, mode: RunnerMode, codexBinaryPath = "") {
  const projectId = project?.id || "project";
  const projectPath = project?.path || "";
  const cwd = runnerCwdForMode(projectPath, mode);
  const target = cwd || ".";
  const withWslShell = (command: string) => `bash -lc ${singleQuote(`cd ${doubleQuote(target)} && ${command}`)}`;
  const codexBinary = codexBinaryPath ? (mode === "wsl" ? toWslPathClient(codexBinaryPath) : codexBinaryPath) : "codex";
  const codexProjectPath = codexBinaryPath && mode === "wsl" ? windowsForwardPath(projectPath) : target;
  const codexCommand = `${doubleQuote(codexBinary)} --no-alt-screen --dangerously-bypass-approvals-and-sandbox -C ${doubleQuote(codexProjectPath || target)}`;
  const claudeCommand = agentPresets.claude.ultraCode.command;
  if (type === "claude-code") {
    return {
      id: "claude-code",
      name: "Claude Code tmux",
      session: `rc-${projectId}`,
      cwd,
      startCommand: mode === "wsl" ? withWslShell(claudeCommand) : claudeCommand
    };
  }
  if (type === "codex-cli") {
    return {
      id: "codex-cli",
      name: "Codex CLI tmux",
      session: `rc-codex-${projectId}`,
      cwd,
      startCommand: mode === "wsl" ? withWslShell(codexCommand) : codexCommand
    };
  }
  return {
    id: "custom",
    name: "Custom tmux",
    session: `rc-${projectId}-custom`,
    cwd,
    startCommand: mode === "wsl" ? withWslShell('echo "configure this runner"') : 'echo "configure this runner"'
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

function looksLikePlaceholderPath(path: string) {
  return /(?:C:\\path\\to\\|\/path\/to\/|\\MyApp\b|\/MyApp\b)/i.test(path);
}

function oneLine(value?: string) {
  return (value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || "";
}

function detailPath(value?: string) {
  const lines = (value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines[1] || lines[0] || "";
}

function shortPath(path?: string) {
  if (!path) return "not found";
  const normalized = path.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  if (parts.length <= 4) return path;
  return `...\\${parts.slice(-4).join("\\")}`;
}

function checkLabel(check?: DoctorCheck) {
  if (!check) return "not checked";
  if (check.status === "ok") return "ready";
  if (check.status === "warn") return "attention";
  return "blocked";
}

function sourceStatusIcon(status: OnboardingStatus) {
  return status === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />;
}

function formatOnboardingSource(source: OnboardingSource) {
  if (!source.exists) return source.detail || "Not found";
  if (source.isDirectory) {
    const entries = source.entries?.length ? `: ${source.entries.slice(0, 4).join(", ")}` : "";
    return `${source.detail}${entries}`;
  }
  return source.preview || source.detail;
}

function buildOnboardingBrief(onboarding: ProjectOnboardingContext | null) {
  if (!onboarding) return "Project onboarding has not been scanned yet.";
  const checks = onboarding.checks.map((item) => `- ${item.status.toUpperCase()} ${item.label}: ${item.detail}`).join("\n");
  const sources = onboarding.contextSources
    .filter((source) => source.exists)
    .map((source) => `- ${source.agent}/${source.kind}: ${source.relative}`)
    .join("\n");
  const mcpSources = [
    ...onboarding.contextSources,
    ...onboarding.agentHomes.flatMap((home) => home.items.map((item) => ({ ...item, agent: home.agent, relative: `${home.scope}:${item.relative}` })))
  ]
    .filter((source) => source.exists && source.kind === "mcp")
    .map((source) => `- ${source.agent}: ${source.relative}`)
    .join("\n");
  const runners = onboarding.runnerProfiles
    .map((runner) => `- ${runner.name} (${runner.agent}, ${runner.mode}, ${runner.session}): ${runner.detail}`)
    .join("\n");
  const homes = onboarding.agentHomes
    .map((home) => {
      const items = home.items.filter((item) => item.exists).map((item) => item.label).join(", ") || "none detected";
      return `- ${home.agent} ${home.scope}: ${items}`;
    })
    .join("\n");
  return [
    `Project onboarding brief: ${onboarding.projectName}`,
    `Path: ${onboarding.path}`,
    "",
    "Checks:",
    checks || "- No checks available.",
    "",
    "Project context sources:",
    sources || "- No project context sources detected.",
    "",
    "MCP sources:",
    mcpSources || "- No project/user MCP config detected.",
    "",
    "Runner profiles:",
    runners || "- No runner profiles configured.",
    "",
    "Local agent homes:",
    homes || "- No local agent homes detected.",
    "",
    "Use this brief to align Claude Code and Codex CLI before proposing implementation or review steps."
  ].join("\n");
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [config, setConfig] = useState<ConfigContext | null>(null);
  const [git, setGit] = useState<GitContext | null>(null);
  const [doctor, setDoctor] = useState<DoctorContext | null>(null);
  const [projectOnboarding, setProjectOnboarding] = useState<ProjectOnboardingContext | null>(null);
  const [usage, setUsage] = useState<UsageContext | null>(null);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [activeStep, setActiveStep] = useState("Discuss");
  const [task, setTask] = useState("Opener dogfood upload screenshot fails after image picker returns.");
  const [busyRunner, setBusyRunner] = useState<string | null>(null);
  const [lastRunnerOutput, setLastRunnerOutput] = useState("");
  const [evidence, setEvidence] = useState(seedEvidence);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(seedEvidence[0]?.id || "");
  const [decisions, setDecisions] = useState(seedDecisions);
  const [busEvents, setBusEvents] = useState<RelayBusEvent[]>([]);
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
  const [runnerMode, setRunnerMode] = useState<RunnerMode>("wsl");
  const [runnerModeTouched, setRunnerModeTouched] = useState(false);
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

  const setup = cleanSetupCopy[lang];

  const recommendedRunnerMode = useMemo<RunnerMode>(() => (doctor?.platform === "win32" ? "wsl" : "native"), [doctor?.platform]);

  useEffect(() => {
    if (!doctor?.platform || runnerModeTouched) return;
    setRunnerMode(recommendedRunnerMode);
  }, [doctor?.platform, recommendedRunnerMode, runnerModeTouched]);

  const commandRunner = useMemo(() => {
    return runners.find((runner) => runner.id === commandRunnerId) || runners.find((runner) => runner.state === "running") || runners[0];
  }, [runners, commandRunnerId]);

  const slashMeta = useMemo(() => slashCommandMeta(slashCommand), [slashCommand]);

  const consoleSlashMeta = useMemo(() => {
    return consoleInput.trim().startsWith("/") ? slashCommandMeta(consoleInput) : null;
  }, [consoleInput]);

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

  const preferredCodexBinary = doctor?.agents?.codex?.selected?.supportsGpt55 ? doctor.agents.codex.selected.path : "";
  const runnerPreset = useMemo(
    () => runnerDefaults(activeProject, runnerType, runnerMode, preferredCodexBinary),
    [activeProject, preferredCodexBinary, runnerMode, runnerType]
  );

  const runnerPreview = useMemo(() => {
    const session = (runnerSession || runnerPreset.session).trim();
    const cwd = (runnerCwd || runnerPreset.cwd).trim();
    const startCommand = (runnerStartCommand || runnerPreset.startCommand).trim();
    const configuredRunners = activeConfigProject?.runners || [];
    const duplicateId = configuredRunners.some((runner) => runner.id === runnerPreset.id);
    const duplicateSession = configuredRunners.some((runner) => runner.session === session);
    const readinessCheck =
      runnerMode === "wsl"
        ? doctorById.get("wsl-tmux-smoke") || doctorById.get("wsl-tmux") || doctorById.get("wsl")
        : doctorById.get("tmux-smoke") || doctorById.get("tmux");
    const warnings: string[] = [];
    const blockers: string[] = [];

    if (duplicateId) blockers.push(`Runner id "${runnerPreset.id}" already exists. Remove it before adding a replacement.`);
    if (duplicateSession) blockers.push(`tmux session "${session}" is already configured for this project.`);
    if (!cwd) warnings.push("Set a tmux cwd before starting this runner.");
    if (cwd && looksLikePlaceholderPath(cwd)) warnings.push("Replace the placeholder cwd with a real project path.");
    if (runnerMode === "wsl" && /^[A-Za-z]:[\\/]/.test(cwd)) warnings.push("WSL mode expects a Linux path such as /mnt/c/Users/you/MyApp.");
    if (runnerMode === "native" && cwd.startsWith("/mnt/")) warnings.push("Native mode expects the path style from the host running tmux.");
    if (!readinessCheck) warnings.push("Run Doctor after saving to verify tmux and agent CLI availability.");
    if (readinessCheck?.status === "warn") warnings.push(`${readinessCheck.label}: ${readinessCheck.detail}`);
    if (readinessCheck?.status === "fail") blockers.push(`${readinessCheck.label}: ${readinessCheck.detail}`);
    if (runnerType === "codex-cli") {
      const usesSelectedCodexBinary =
        Boolean(preferredCodexBinary && startCommand.includes(toWslPathClient(preferredCodexBinary))) ||
        /\bcodex\.exe\b/i.test(startCommand);
      const codexCapability = runnerMode === "wsl" && !usesSelectedCodexBinary ? doctorById.get("wsl-codex-gpt-55") : doctorById.get("codex-gpt-55");
      const codexJson = doctorById.get("codex-json-events");
      if (!codexCapability) {
        warnings.push("Run Doctor to confirm this Codex runner can use the latest target model.");
      } else if (codexCapability.status !== "ok") {
        warnings.push(`${codexCapability.label}: ${codexCapability.detail}`);
      }
      if (!usesSelectedCodexBinary && runnerMode === "wsl" && doctorById.get("codex-gpt-55")?.status === "ok" && doctorById.get("wsl-codex-gpt-55")?.status !== "ok") {
        warnings.push("Desktop Codex is newer than WSL Codex; WSL runner may not match desktop quality.");
      }
      if (codexJson?.status === "fail") warnings.push(`${codexJson.label}: ${codexJson.detail}`);
    }
    if (runnerType === "claude-code") {
      const claudeEffort = doctorById.get("claude-effort-mode");
      const claudeOpus = doctorById.get("claude-opus-48");
      const claudeUltra = doctorById.get("claude-ultra-code");
      if (claudeEffort?.status === "warn") warnings.push(`${claudeEffort.label}: ${claudeEffort.detail}`);
      if (claudeOpus?.status === "warn") warnings.push(`${claudeOpus.label}: ${claudeOpus.detail}`);
      if (claudeUltra?.status === "warn") warnings.push(`${claudeUltra.label}: ${claudeUltra.detail}`);
    }

    return {
      blockers,
      cwd,
      hostPath: activeProject?.path || "",
      readinessCheck,
      session,
      startCommand,
      warnings
    };
  }, [
    activeConfigProject?.runners,
    activeProject?.path,
    doctorById,
    runnerCwd,
    runnerMode,
    runnerPreset.cwd,
    runnerPreset.id,
    runnerPreset.session,
    runnerPreset.startCommand,
    runnerSession,
    runnerStartCommand,
    runnerType,
    preferredCodexBinary
  ]);

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
      sent: decisions.filter((item) => item.status !== "open").length
    };
  }, [decisions]);

  const busCounts = useMemo(() => {
    return {
      total: busEvents.length,
      pending: busEvents.filter((item) => item.status === "open" || item.status === "queued" || item.status === "sent").length,
      acked: busEvents.filter((item) => item.kind === "ack" || item.status === "acked").length,
      consensus: busEvents.filter((item) => item.kind === "consensus").length
    };
  }, [busEvents]);

  const visibleBusEvents = useMemo(() => busEvents.slice(0, 8), [busEvents]);

  const setupRows = useMemo(() => {
    const pathChecks = (doctor?.checks || []).filter((item) => item.id.startsWith("project-"));
    const terminalChecks = ["wsl", "wsl-tmux", "wsl-tmux-smoke", "tmux", "tmux-smoke"].map((id) => doctorById.get(id)).filter(Boolean) as DoctorCheck[];
    const agentChecks = ["wsl-claude", "claude-opus-48", "claude-ultra-code", "wsl-codex", "wsl-codex-gpt-55", "claude-selected-cli", "codex-gpt-55"]
      .map((id) => doctorById.get(id))
      .filter(Boolean) as DoctorCheck[];
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

  const parityRows = useMemo(() => {
    const selectedCodex = doctor?.agents?.codex?.selected;
    const pathCodex = doctor?.agents?.codex?.pathDefault;
    const selectedClaude = doctor?.agents?.claude?.selected;
    return [
      {
        id: "claude",
        label: "Claude runner",
        status: doctorById.get("claude-selected-cli")?.status || "warn",
        value: selectedClaude?.version ? `${selectedClaude.version} (${selectedClaude.source})` : oneLine(doctorById.get("claude-selected-cli")?.detail) || "not checked",
        detail: shortPath(selectedClaude?.path || detailPath(doctorById.get("claude-selected-cli")?.detail))
      },
      {
        id: "claude-mode",
        label: agentPresets.claude.ultraCode.label,
        status: doctorById.get("claude-ultra-code")?.status || doctorById.get("claude-opus-48")?.status || "warn",
        value:
          doctorById.get("claude-ultra-code")?.status === "ok"
            ? `${agentPresets.claude.ultraCode.model} + ${agentPresets.claude.ultraCode.effort}`
            : checkLabel(doctorById.get("claude-ultra-code")),
        detail: doctorById.get("claude-stream-json")?.status === "ok" ? "stream-json available" : "check stream-json support"
      },
      {
        id: "codex",
        label: "Codex selected",
        status: doctorById.get("codex-gpt-55")?.status || doctorById.get("codex-selected-cli")?.status || "warn",
        value: selectedCodex?.version ? `${selectedCodex.version} (${selectedCodex.source})` : oneLine(doctorById.get("codex-selected-cli")?.detail) || "not checked",
        detail: shortPath(selectedCodex?.path || detailPath(doctorById.get("codex-selected-cli")?.detail))
      },
      {
        id: "codex-path",
        label: "PATH Codex",
        status: doctorById.get("codex-path-shadow")?.status || "warn",
        value: pathCodex?.version ? `${pathCodex.version} (${pathCodex.source})` : "not found",
        detail: doctorById.get("codex-path-shadow")?.status === "ok" ? "PATH matches selected" : "PATH may launch an older Codex"
      },
      {
        id: "wsl-codex",
        label: "WSL plain Codex",
        status: doctorById.get("wsl-codex-gpt-55")?.status || doctorById.get("wsl-codex")?.status || "warn",
        value: oneLine(doctorById.get("wsl-codex-gpt-55")?.detail) || oneLine(doctorById.get("wsl-codex")?.detail) || "not checked",
        detail: "Only used when a WSL startCommand calls plain codex instead of an explicit binary."
      }
    ] satisfies Array<{ id: string; label: string; status: DoctorCheck["status"]; value: string; detail: string }>;
  }, [doctor?.agents?.claude?.selected, doctor?.agents?.codex?.pathDefault, doctor?.agents?.codex?.selected, doctorById]);

  const onboardingContextSources = useMemo(() => {
    const sources = projectOnboarding?.contextSources || [];
    const importantMissing = new Set(["agents-md", "claude-md", "mcp-json", "claude-mcp-json", "codex-mcp-json", "codex-config", "claude-settings"]);
    return sources.filter((source) => source.exists || importantMissing.has(source.id)).slice(0, 16);
  }, [projectOnboarding?.contextSources]);

  const onboardingLocalItems = useMemo(() => {
    return (projectOnboarding?.agentHomes || [])
      .flatMap((home) =>
        home.items
          .filter((item) => item.exists)
          .map((item) => ({
            ...item,
            label: `${home.agent} ${home.scope}: ${item.label}`
          }))
      )
      .slice(0, 12);
  }, [projectOnboarding?.agentHomes]);

  const onboardingSteps = useMemo(() => {
    const projectPath = activeProject?.path || "";
    const projectCheck = activeProject ? doctorById.get(`project-${activeProject.id}`) : undefined;
    const runnerCount = activeConfigProject?.runners?.length || 0;
    const runningCount = runners.filter((runner) => runner.state === "running").length;
    const localConfigReady = config?.source.kind === "local";
    const projectReady = Boolean(projectPath && !looksLikePlaceholderPath(projectPath) && projectCheck?.status !== "fail");
    const runnerReady = runnerCount > 0;
    const doctorReady = Boolean(doctor && doctor.summary.fail === 0);
    const startReady = runningCount > 0;
    const stepCopy = setup.onboarding.steps;
    const actionCopy = setup.onboarding.actions;

    return [
      {
        id: "config",
        status: localConfigReady ? "ok" : "warn",
        label: stepCopy.config.label,
        detail: localConfigReady ? config?.source.path || stepCopy.config.detail : "Using example config. Create relay.local.json before real work.",
        action: actionCopy.config,
        target: "config"
      },
      {
        id: "project",
        status: projectReady ? "ok" : projectCheck?.status === "fail" ? "fail" : "warn",
        label: stepCopy.project.label,
        detail: projectReady ? projectPath : projectCheck?.detail || stepCopy.project.detail,
        action: actionCopy.project,
        target: "project"
      },
      {
        id: "runner",
        status: runnerReady ? "ok" : "warn",
        label: stepCopy.runner.label,
        detail: runnerReady ? `${runnerCount} runner session${runnerCount === 1 ? "" : "s"} configured` : stepCopy.runner.detail,
        action: actionCopy.runner,
        target: "runner"
      },
      {
        id: "doctor",
        status: doctorReady ? "ok" : doctor?.summary.fail ? "fail" : "warn",
        label: stepCopy.doctor.label,
        detail: doctor ? `${doctor.summary.ok} ok / ${doctor.summary.warn} warn / ${doctor.summary.fail} fail` : stepCopy.doctor.detail,
        action: actionCopy.doctor,
        target: "doctor"
      },
      {
        id: "start",
        status: startReady ? "ok" : "warn",
        label: stepCopy.start.label,
        detail: startReady ? `${runningCount} runner${runningCount === 1 ? "" : "s"} running` : stepCopy.start.detail,
        action: actionCopy.start,
        target: "start"
      }
    ] satisfies Array<{
      id: "config" | "project" | "runner" | "doctor" | "start";
      status: DoctorCheck["status"];
      label: string;
      detail: string;
      action: string;
      target: "config" | "project" | "runner" | "doctor" | "start";
    }>;
  }, [activeConfigProject?.runners, activeProject, config?.source.kind, config?.source.path, doctor, doctorById, runners, setup]);

  const nextOnboardingStep = useMemo(() => onboardingSteps.find((step) => step.status !== "ok"), [onboardingSteps]);
  const completedOnboardingSteps = onboardingSteps.filter((step) => step.status === "ok").length;

  function currentSessionState(): RelaySessionState {
    return {
      activeStep,
      task,
      decisions,
      evidence,
      busEvents,
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
    setBusEvents(Array.isArray(state.busEvents) ? state.busEvents : []);
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
      busEvents: [],
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
    const [nextGit, nextRunners, nextDoctor, nextOnboarding, nextUsage, nextConfig] = await Promise.all([
      getJson<GitContext>(`/api/git?projectId=${encodeURIComponent(project.id)}`),
      getJson<{ runners: Runner[] }>(`/api/runners?projectId=${encodeURIComponent(project.id)}`),
      getJson<DoctorContext>("/api/doctor"),
      getJson<ProjectOnboardingContext>(`/api/onboarding?projectId=${encodeURIComponent(project.id)}`),
      getJson<UsageContext>("/api/usage"),
      getJson<ConfigContext>("/api/config")
    ]);
    setGit(nextGit);
    setRunners(nextRunners.runners);
    setDoctor(nextDoctor);
    setProjectOnboarding(nextOnboarding);
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
    busEvents,
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
    options: { text?: string; confirmMessage?: string; onSuccess?: () => void; suppressBusEvent?: boolean } = {}
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
      if (result.ok !== false) {
        options.onSuccess?.();
        if (action === "send" && !options.suppressBusEvent) {
          appendBusEvent({
            kind: "message",
            status: "sent",
            title: `Sent to ${runner.session}`,
            summary: options.text ?? task,
            targetRunnerId: runner.id,
            targetName: runner.session
          });
        }
      }
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

  async function sendSlashCommand(value = slashCommand, options: { source?: "console" | "panel" } = {}) {
    const command = normalizeSlashCommand(value);
    if (!command) return;
    if (!commandRunner) {
      const message = "No runner is configured for this project.";
      setConsoleOutput(message);
      setLastRunnerOutput(message);
      return;
    }
    if (commandRunner.state !== "running") {
      const message = `Start ${commandRunner.session} before sending slash commands.`;
      setConsoleOutput(message);
      setLastRunnerOutput(message);
      return;
    }

    const meta = slashCommandMeta(command);
    if (meta.risk !== "safe") {
      const ok = window.confirm(slashConfirmMessage(command, commandRunner, meta));
      if (!ok) {
        const message = `Slash command canceled: ${command}`;
        setLastRunnerOutput(message);
        return;
      }
    }

    setBusyRunner(`${commandRunner.id}:slash-send`);
    try {
      await postRunnerAction(commandRunner, "send", { text: command });
      appendBusEvent({
        kind: "message",
        status: "sent",
        title: `Slash command to ${commandRunner.session}`,
        summary: command,
        targetRunnerId: commandRunner.id,
        targetName: commandRunner.session
      });
      setSlashCommand(command);
      if (options.source === "console") setConsoleInput("");
      const pendingMessage = [
        `[RelayDesk slash -> ${commandRunner.session}]`,
        command,
        "",
        `${slashRiskCopy[meta.risk].label}. Auto-peek in ${formatSlashDelay(meta.captureDelayMs)}.`
      ].join("\n");
      setConsoleOutput((current) => `${current ? `${current}\n\n` : ""}${pendingMessage}`);
      setLastRunnerOutput(pendingMessage);
      await new Promise<void>((resolve) => window.setTimeout(resolve, meta.captureDelayMs));
      await captureConsole(commandRunner, { mode: "peek", silent: true });
      await refresh(activeProject);
    } catch (error) {
      const message = `Slash command failed: ${String(error)}`;
      setConsoleOutput(message);
      setLastRunnerOutput(message);
    } finally {
      setBusyRunner(null);
    }
  }

  async function sendConsoleInput(value = consoleInput) {
    const text = value.trim();
    if (!text) return;
    if (text.startsWith("/")) {
      await sendSlashCommand(text, { source: "console" });
      return;
    }
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
      appendBusEvent({
        kind: "message",
        status: "sent",
        title: `Console message to ${commandRunner.session}`,
        summary: text,
        targetRunnerId: commandRunner.id,
        targetName: commandRunner.session
      });
      setConsoleInput("");
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
      const reviewerRunnerId = defaultReviewerId(runner.id);
      const evidenceItem: Evidence = {
        id: `${saved.name}-${Date.now()}`,
        name: saved.name,
        kind: "image",
        size: `${frame.width}x${frame.height}`,
        source: runner.session,
        sourceRunnerId: runner.id,
        reviewerRunnerId,
        path: saved.hostPath,
        wslPath: saved.wslPath,
        capturedAt: new Date().toISOString()
      };
      const reviewerRunner = runnerById(reviewerRunnerId);
      const replyDraft = snapshotReply(runner, task, saved.hostPath, saved.wslPath, "", {
        sourceName: runner.session,
        reviewerName: reviewerRunner?.session
      });
      setEvidence((current) => [evidenceItem, ...current].slice(0, 8));
      setSelectedEvidenceId(evidenceItem.id);
      const snapshotDecision: DecisionItem = {
        id: `snapshot-${runner.session}-${Date.now()}`,
        source: `${runner.session} snapshot`,
        sourceRunnerId: runner.id,
        reviewerRunnerId: defaultReviewerId(runner.id),
        title: "Conversation snapshot review",
        prompt: `Review the captured ${runner.session} conversation screen before the next agent step.`,
        options: ["Send to reviewer", "Need OCR text", "Retake snapshot"],
        selected: "Send to reviewer",
        note: `Snapshot saved at ${saved.wslPath}`,
        replyDraft,
        status: "open"
      };
      setDecisions((current) => [
        snapshotDecision,
        ...current
      ].slice(0, 12));
      appendBusEvent({
        kind: "snapshot",
        status: "captured",
        title: `Snapshot captured from ${runner.session}`,
        summary: `Saved ${saved.name} for second-pass review.`,
        sourceRunnerId: runner.id,
        sourceName: runner.session,
        targetRunnerId: reviewerRunnerId,
        targetName: reviewerRunner?.session,
        decisionId: snapshotDecision.id,
        evidenceId: evidenceItem.id
      });
      appendBusEvent({
        kind: "decision",
        status: "open",
        title: snapshotDecision.title,
        summary: snapshotDecision.prompt,
        sourceRunnerId: runner.id,
        sourceName: runner.session,
        targetRunnerId: reviewerRunnerId,
        targetName: reviewerRunner?.session,
        decisionId: snapshotDecision.id,
        evidenceId: evidenceItem.id
      });
      setLastRunnerOutput(`Snapshot saved and review card drafted.\nWindows: ${saved.hostPath}\nWSL: ${saved.wslPath}`);
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

  function updateEvidence(id: string, patch: Partial<Evidence>) {
    setEvidence((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function appendBusEvent(input: Omit<RelayBusEvent, "id" | "at"> & Partial<Pick<RelayBusEvent, "id" | "at">>) {
    const sourceRunner = input.sourceRunnerId ? runnerById(input.sourceRunnerId) : undefined;
    const targetRunner = input.targetRunnerId ? runnerById(input.targetRunnerId) : undefined;
    const event: RelayBusEvent = {
      ...input,
      id: input.id || `bus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: input.at || new Date().toISOString(),
      sourceName: input.sourceName || sourceRunner?.session || input.sourceRunnerId || "",
      targetName: input.targetName || targetRunner?.session || input.targetRunnerId || "",
      summary: compactSummary(input.summary)
    };
    setBusEvents((current) => [event, ...current].slice(0, 40));
    return event;
  }

  function evidenceSourceRunner(item: Evidence) {
    return runnerById(item.sourceRunnerId) || (item.source ? runners.find((runner) => runner.session === item.source) : undefined) || commandRunner;
  }

  function evidenceReviewerRunner(item: Evidence) {
    const sourceRunner = evidenceSourceRunner(item);
    return runnerById(item.reviewerRunnerId) || runnerById(defaultReviewerId(sourceRunner?.id || "")) || runners[0];
  }

  function evidenceRelayRoute(item: Evidence): RelayRouteContext {
    const sourceRunner = evidenceSourceRunner(item);
    const reviewerRunner = evidenceReviewerRunner(item);
    return {
      sourceName: sourceRunner?.session || item.source,
      reviewerName: reviewerRunner?.session
    };
  }

  function buildEvidenceDecision(item: Evidence): DecisionItem {
    const sourceRunner = evidenceSourceRunner(item);
    const reviewerRunner = evidenceReviewerRunner(item);
    const route = evidenceRelayRoute(item);
    const isSnapshot = item.kind === "image" && Boolean(item.sourceRunnerId || item.source);
    const pathNote = [item.wslPath || item.path || "Local browser file selected.", item.note ? `OCR / context: ${item.note}` : ""]
      .filter(Boolean)
      .join("\n");
    const replyDraft =
      isSnapshot && sourceRunner && item.path && item.wslPath
        ? snapshotReply(sourceRunner, task, item.path, item.wslPath, item.note || "", route)
        : evidenceHandoffText(item, task, route);
    return {
      id: `evidence-${item.id}-${Date.now()}`,
      source: item.source ? `${item.source} evidence` : "Evidence tray",
      sourceRunnerId: sourceRunner?.id || "",
      reviewerRunnerId: reviewerRunner?.id || "",
      title: isSnapshot ? `Snapshot review: ${item.source || item.name}` : `Review evidence: ${item.name}`,
      prompt: isSnapshot ? `Review the captured ${item.source || "agent"} conversation screen before the next agent step.` : `Review ${item.name} before the next agent step.`,
      options: isSnapshot ? ["Send to reviewer", "Need OCR text", "Retake snapshot"] : ["Send to reviewer", "Need OCR text", "Need more evidence"],
      selected: "Send to reviewer",
      note: pathNote,
      replyDraft,
      status: "open"
    };
  }

  async function createEvidenceRelay(item = selectedEvidence, options: { send?: boolean } = {}) {
    if (!item) return;
    const evidenceDecision = buildEvidenceDecision(item);
    const sourceRunner = evidenceSourceRunner(item);
    const reviewerRunner = evidenceReviewerRunner(item);
    setDecisions((current) => [evidenceDecision, ...current].slice(0, 12));
    appendBusEvent({
      kind: "decision",
      status: options.send ? "queued" : "open",
      title: evidenceDecision.title,
      summary: evidenceDecision.prompt,
      sourceRunnerId: sourceRunner?.id,
      sourceName: sourceRunner?.session || item.source || "Evidence tray",
      targetRunnerId: reviewerRunner?.id,
      targetName: reviewerRunner?.session,
      decisionId: evidenceDecision.id,
      evidenceId: item.id
    });
    if (!options.send) {
      setLastRunnerOutput(`Evidence review drafted for ${item.name}.`);
      return;
    }

    if (!reviewerRunner || reviewerRunner.state !== "running") {
      setLastRunnerOutput(`Evidence review drafted. Start ${reviewerRunner?.session || "the reviewer runner"} before sending it.`);
      return;
    }

    await runRunner(reviewerRunner, "send", {
      text: evidenceDecision.replyDraft,
      confirmMessage: `Send evidence review to ${reviewerRunner.session}?`,
      onSuccess: () => {
        appendBusEvent({
          kind: "review_request",
          status: "sent",
          title: `Evidence review sent to ${reviewerRunner.session}`,
          summary: evidenceDecision.replyDraft,
          sourceRunnerId: sourceRunner?.id,
          sourceName: sourceRunner?.session || item.source || "Evidence tray",
          targetRunnerId: reviewerRunner.id,
          targetName: reviewerRunner.session,
          decisionId: evidenceDecision.id,
          evidenceId: item.id
        });
        appendBusEvent({
          kind: "ack",
          status: "acked",
          title: `${reviewerRunner.session} accepted review handoff`,
          summary: "RelayDesk send-keys completed for the evidence review request.",
          sourceName: "RelayDesk",
          targetRunnerId: reviewerRunner.id,
          targetName: reviewerRunner.session,
          decisionId: evidenceDecision.id,
          evidenceId: item.id
        });
        updateDecision(evidenceDecision.id, {
          status: "reviewing",
          sentAt: new Date().toISOString()
        });
      },
      suppressBusEvent: true
    });
  }

  function runnerById(id = "") {
    return runners.find((runner) => runner.id === id);
  }

  function runnerFromDecisionSource(decision: DecisionItem) {
    return runnerById(decision.sourceRunnerId) || runners.find((runner) => decision.source.includes(runner.session));
  }

  function defaultReviewerId(sourceRunnerId = "") {
    return runners.find((runner) => runner.id !== sourceRunnerId)?.id || runners[0]?.id || "";
  }

  function decisionSourceRunner(decision: DecisionItem) {
    return runnerFromDecisionSource(decision) || runnerById(writerRunnerId) || runners[0];
  }

  function decisionReviewerRunner(decision: DecisionItem) {
    const sourceRunner = decisionSourceRunner(decision);
    return runnerById(decision.reviewerRunnerId) || runnerById(defaultReviewerId(sourceRunner?.id || "")) || runners[0];
  }

  function relayRoute(decision: DecisionItem): RelayRouteContext {
    const sourceRunner = decisionSourceRunner(decision);
    const reviewerRunner = decisionReviewerRunner(decision);
    return {
      sourceName: sourceRunner?.session || decision.source,
      reviewerName: reviewerRunner?.session
    };
  }

  function relayPatch(decision: DecisionItem) {
    const sourceRunner = decisionSourceRunner(decision);
    const reviewerRunner = decisionReviewerRunner(decision);
    return {
      sourceRunnerId: sourceRunner?.id || "",
      reviewerRunnerId: reviewerRunner?.id || ""
    };
  }

  function trimmedRelayOutput(output: string) {
    const cleaned = output
      .split(/\r?\n/)
      .map(cleanCaptureLine)
      .filter(Boolean)
      .join("\n")
      .trim();
    if (cleaned.length <= 1800) return cleaned || "Captured an empty tmux pane.";
    return `${cleaned.slice(-1800)}\n[RelayDesk kept the latest 1800 characters.]`;
  }

  function appendReviewerNote(decision: DecisionItem, runner: Runner, output: string) {
    const stamp = new Date().toLocaleString();
    const block = [`Reviewer capture from ${runner.session} at ${stamp}:`, trimmedRelayOutput(output)].join("\n");
    return [decision.note.trim(), block].filter(Boolean).join("\n\n");
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
        sourceRunnerId: runner.id,
        reviewerRunnerId: defaultReviewerId(runner.id),
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
    incoming.forEach((item) =>
      appendBusEvent({
        kind: "decision",
        status: "open",
        title: item.title,
        summary: item.prompt,
        sourceRunnerId: item.sourceRunnerId,
        sourceName: item.source,
        targetRunnerId: item.reviewerRunnerId,
        decisionId: item.id
      })
    );
    return incoming.length;
  }

  function updateDecision(id: string, patch: Partial<DecisionItem>) {
    setDecisions((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addDecision() {
    const value = decisionDraft.trim();
    if (!value) return;
    const title = value.length > 52 ? `${value.slice(0, 49)}...` : value;
    const decision: DecisionItem = {
      id: `decision-${Date.now()}`,
      source: "You",
      sourceRunnerId: writerRunner?.id || "",
      reviewerRunnerId: defaultReviewerId(writerRunner?.id || ""),
      title,
      prompt: value,
      options: ["Proceed", "Hold", "Ask both agents"],
      selected: "Proceed",
      note: "",
      replyDraft: "",
      status: "open"
    };
    setDecisions((current) => [decision, ...current]);
    appendBusEvent({
      kind: "decision",
      status: "open",
      title: decision.title,
      summary: decision.prompt,
      sourceName: "You",
      sourceRunnerId: decision.sourceRunnerId,
      targetRunnerId: decision.reviewerRunnerId,
      decisionId: decision.id
    });
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

  async function sendReviewRequest(decision: DecisionItem) {
    const reviewerRunner = decisionReviewerRunner(decision);
    if (!reviewerRunner) {
      setLastRunnerOutput("No reviewer runner is configured for this decision.");
      return;
    }
    const route = relayRoute(decision);
    const patch = relayPatch(decision);
    const text = buildAgentReply({ ...decision, ...patch }, task, route);
    await runRunner(reviewerRunner, "send", {
      text,
      confirmMessage: `Send review request to ${reviewerRunner.session}?`,
      onSuccess: () => {
        appendBusEvent({
          kind: "review_request",
          status: "sent",
          title: `Review request sent to ${reviewerRunner.session}`,
          summary: text,
          sourceRunnerId: patch.sourceRunnerId,
          sourceName: route.sourceName || decision.source,
          targetRunnerId: reviewerRunner.id,
          targetName: reviewerRunner.session,
          decisionId: decision.id
        });
        appendBusEvent({
          kind: "ack",
          status: "acked",
          title: `${reviewerRunner.session} accepted review handoff`,
          summary: "RelayDesk send-keys completed for the review request.",
          sourceName: "RelayDesk",
          targetRunnerId: reviewerRunner.id,
          targetName: reviewerRunner.session,
          decisionId: decision.id
        });
        updateDecision(decision.id, {
          ...patch,
          replyDraft: text,
          status: "reviewing",
          sentAt: new Date().toISOString()
        });
      },
      suppressBusEvent: true
    });
  }

  async function captureReviewerVerdict(decision: DecisionItem) {
    const reviewerRunner = decisionReviewerRunner(decision);
    if (!reviewerRunner) {
      setLastRunnerOutput("No reviewer runner is configured for this decision.");
      return;
    }
    if (reviewerRunner.state !== "running") {
      setLastRunnerOutput(`Start ${reviewerRunner.session} before capturing reviewer output.`);
      return;
    }

    const patch = relayPatch(decision);
    setBusyRunner(`${reviewerRunner.id}:relay-capture`);
    try {
      const result = await postRunnerAction(reviewerRunner, "capture");
      const note = appendReviewerNote(decision, reviewerRunner, result.output || "");
      const nextDecision = { ...decision, ...patch, note };
      const replyDraft = buildReturnVerdict(nextDecision, task, relayRoute(nextDecision));
      setConsoleOutput(result.output || "Captured an empty tmux pane.");
      setConsoleLastCaptureAt(new Date().toLocaleTimeString());
      updateDecision(decision.id, {
        ...patch,
        note,
        replyDraft,
        status: "reviewed",
        reviewedAt: new Date().toISOString()
      });
      appendBusEvent({
        kind: "capture",
        status: "captured",
        title: `Reviewer capture from ${reviewerRunner.session}`,
        summary: result.output || "Captured an empty tmux pane.",
        sourceRunnerId: reviewerRunner.id,
        sourceName: reviewerRunner.session,
        targetRunnerId: patch.sourceRunnerId,
        targetName: relayRoute(nextDecision).sourceName,
        decisionId: decision.id
      });
      setLastRunnerOutput(`Reviewer verdict captured from ${reviewerRunner.session}.`);
      await refresh(activeProject);
    } catch (error) {
      setLastRunnerOutput(`Reviewer capture failed: ${String(error)}`);
    } finally {
      setBusyRunner(null);
    }
  }

  async function returnVerdictToSource(decision: DecisionItem) {
    const sourceRunner = decisionSourceRunner(decision);
    if (!sourceRunner) {
      setLastRunnerOutput("No source runner is configured for this decision.");
      return;
    }
    const route = relayRoute(decision);
    const patch = relayPatch(decision);
    const text = buildReturnVerdict({ ...decision, ...patch }, task, route);
    await runRunner(sourceRunner, "send", {
      text,
      confirmMessage: `Return verdict to ${sourceRunner.session}?`,
      onSuccess: () => {
        appendBusEvent({
          kind: "verdict",
          status: "returned",
          title: `Verdict returned to ${sourceRunner.session}`,
          summary: text,
          sourceRunnerId: patch.reviewerRunnerId,
          sourceName: route.reviewerName || "Reviewer",
          targetRunnerId: sourceRunner.id,
          targetName: sourceRunner.session,
          decisionId: decision.id
        });
        appendBusEvent({
          kind: "consensus",
          status: "returned",
          title: `Consensus recorded: ${decision.selected}`,
          summary: `${decision.title}: ${decision.selected}`,
          sourceRunnerId: patch.reviewerRunnerId,
          sourceName: route.reviewerName || "Reviewer",
          targetRunnerId: sourceRunner.id,
          targetName: sourceRunner.session,
          decisionId: decision.id
        });
        updateDecision(decision.id, {
          ...patch,
          replyDraft: text,
          status: "returned",
          returnedAt: new Date().toISOString()
        });
      },
      suppressBusEvent: true
    });
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

  function focusOnboardingTarget(target: "project" | "runner" | "doctor" | "start") {
    const selector =
      target === "project"
        ? "[data-onboarding-target='project']"
        : target === "runner"
          ? "[data-onboarding-target='runner']"
          : target === "doctor"
            ? "[data-onboarding-target='doctor']"
            : "[data-onboarding-target='start']";
    const element = document.querySelector(selector) as HTMLElement | null;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLButtonElement) {
      element.focus();
    }
  }

  function runOnboardingAction(step: (typeof onboardingSteps)[number]) {
    if (step.id === "config") {
      void copySetupCommand("onboarding-config", setup.commands.config);
      return;
    }
    if (step.id === "doctor") {
      if (activeProject) void refresh(activeProject);
      focusOnboardingTarget("doctor");
      return;
    }
    focusOnboardingTarget(step.target);
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
      busEvents,
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

  async function copyProjectOnboardingBrief() {
    try {
      await copyTextToClipboard(buildOnboardingBrief(projectOnboarding));
      setCopiedSetup("project-onboarding-brief");
      window.setTimeout(() => setCopiedSetup((current) => (current === "project-onboarding-brief" ? "" : current)), 1400);
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
        setProjectOnboarding(null);
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
    if (runnerPreview.blockers.length) return;
    const { cwd, session, startCommand } = runnerPreview;
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
        mode: runnerMode,
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
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendConsoleInput();
                }
              }}
              placeholder="Type a task, decision reply, /help, /clear, /compact..."
            />
            <button disabled={!!busyRunner || commandRunner?.state !== "running" || !consoleInput.trim()} onClick={() => void sendConsoleInput()}>
              <Send size={13} />
              Send
            </button>
          </div>
          {consoleSlashMeta ? (
            <div className="slash-command-advice">
              <span className={cx("slash-risk", consoleSlashMeta.risk)}>{slashRiskCopy[consoleSlashMeta.risk].label}</span>
              {" "}
              <span>
                {slashRiskCopy[consoleSlashMeta.risk].description} Auto-peek after {formatSlashDelay(consoleSlashMeta.captureDelayMs)}.
              </span>
            </div>
          ) : null}
          <div className="console-presets">
            {slashCommandPresets.map((preset) => (
              <button
                key={`console-${preset.id}`}
                className={cx("slash-preset", preset.risk)}
                disabled={!!busyRunner || commandRunner?.state !== "running"}
                title={preset.hint}
                onClick={() => void sendSlashCommand(preset.command, { source: "console" })}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="relay-bus-panel" data-testid="relay-bus-panel">
          <div className="tray-head">
            <div>
              <div className="section-label">Relay Bus</div>
              <h2>Two-way protocol</h2>
            </div>
            <div className="bus-stats">
              <span>
                <strong>{busCounts.total}</strong>
                events
              </span>
              <span>
                <strong>{busCounts.pending}</strong>
                pending
              </span>
              <span>
                <strong>{busCounts.acked}</strong>
                ACK
              </span>
              <span>
                <strong>{busCounts.consensus}</strong>
                consensus
              </span>
            </div>
          </div>
          <div className="bus-event-list">
            {visibleBusEvents.map((event) => {
              const route = [event.sourceName || "You", event.targetName].filter(Boolean).join(" -> ");
              return (
                <article className={cx("bus-event", event.kind, event.status)} key={event.id}>
                  <div className="bus-event-head">
                    <span className="bus-event-kind">
                      {busEventIcon(event.kind)}
                      {busEventCopy[event.kind].label}
                    </span>
                    <time>{formatTime(event.at)}</time>
                  </div>
                  <strong>{event.title}</strong>
                  <p>{event.summary}</p>
                  <small>
                    {route || "local event"}
                    {event.decisionId ? ` / ${event.decisionId}` : ""}
                  </small>
                </article>
              );
            })}
            {!visibleBusEvents.length && <div className="empty-note">No relay bus events in this session yet.</div>}
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
            {decisions.map((decision) => {
              const routedDecision = { ...decision, ...relayPatch(decision) };
              const sourceRunner = decisionSourceRunner(routedDecision);
              const reviewerRunner = decisionReviewerRunner(routedDecision);
              const route = relayRoute(routedDecision);

              return (
                <article className={cx("decision-card", decision.status !== "open" && "sent")} key={decision.id}>
                  <div className="decision-card-head">
                    <div>
                      <span className="decision-source">
                        <Inbox size={13} />
                        {decision.source}
                      </span>
                      <strong>{decision.title}</strong>
                    </div>
                    <span className={cx("decision-state", decision.status)}>
                      {decision.status !== "open" ? <Check size={13} /> : <CircleDot size={13} />}
                      {decision.status}
                    </span>
                  </div>
                  <p className="decision-prompt">{decision.prompt}</p>
                  <div className="relay-route">
                    <label>
                      <span>Source</span>
                      <select
                        value={routedDecision.sourceRunnerId || ""}
                        onChange={(event) => {
                          const sourceRunnerId = event.target.value;
                          updateDecision(decision.id, {
                            sourceRunnerId,
                            reviewerRunnerId:
                              decision.reviewerRunnerId && decision.reviewerRunnerId !== sourceRunnerId
                                ? decision.reviewerRunnerId
                                : defaultReviewerId(sourceRunnerId),
                            status: "open"
                          });
                        }}
                      >
                        <option value="">Manual / unknown</option>
                        {runners.map((runner) => (
                          <option value={runner.id} key={`${decision.id}-source-${runner.id}`}>
                            {runner.session}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="relay-arrow">to</div>
                    <label>
                      <span>Reviewer</span>
                      <select
                        value={routedDecision.reviewerRunnerId || ""}
                        onChange={(event) => updateDecision(decision.id, { reviewerRunnerId: event.target.value, status: "open" })}
                      >
                        <option value="">Choose reviewer</option>
                        {runners.map((runner) => (
                          <option value={runner.id} key={`${decision.id}-reviewer-${runner.id}`}>
                            {runner.session}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="relay-trail">
                    <span className={cx(decision.sentAt && "done")}>review {decision.sentAt ? formatTime(decision.sentAt) : "not sent"}</span>
                    <span className={cx(decision.reviewedAt && "done")}>capture {decision.reviewedAt ? formatTime(decision.reviewedAt) : "waiting"}</span>
                    <span className={cx(decision.returnedAt && "done")}>return {decision.returnedAt ? formatTime(decision.returnedAt) : "pending"}</span>
                  </div>
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
                    placeholder="Decision context or reviewer verdict..."
                  />
                  <div className="reply-draft-box">
                    <div className="reply-draft-head">
                      <span>Cross-agent reply</span>
                      <div>
                        <button
                          onClick={() =>
                            updateDecision(decision.id, {
                              ...relayPatch(decision),
                              replyDraft: buildAgentReply(routedDecision, task, route),
                              status: "open"
                            })
                          }
                        >
                          Ask reviewer
                        </button>
                        <button
                          onClick={() =>
                            updateDecision(decision.id, {
                              ...relayPatch(decision),
                              replyDraft: buildReturnVerdict(routedDecision, task, route),
                              status: "open"
                            })
                          }
                        >
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
                    <small>
                      {route.sourceName || "manual source"} {"->"} {route.reviewerName || "reviewer"} {"->"} source
                    </small>
                    <div className="decision-actions">
                      <button disabled={!!busyRunner || !reviewerRunner || reviewerRunner.state !== "running"} onClick={() => void sendReviewRequest(decision)}>
                        <Send size={13} />
                        Send review
                      </button>
                      <button disabled={!!busyRunner || !reviewerRunner || reviewerRunner.state !== "running"} onClick={() => void captureReviewerVerdict(decision)}>
                        <FileDiff size={13} />
                        Capture reviewer
                      </button>
                      <button disabled={!!busyRunner || !sourceRunner || sourceRunner.state !== "running"} onClick={() => void returnVerdictToSource(decision)}>
                        <Send size={13} />
                        Return source
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
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
          {selectedEvidence &&
            (() => {
              const sourceRunner = evidenceSourceRunner(selectedEvidence);
              const reviewerRunner = evidenceReviewerRunner(selectedEvidence);
              const reviewerId = selectedEvidence.reviewerRunnerId || reviewerRunner?.id || "";
              const canRetake = Boolean(selectedEvidence.sourceRunnerId || selectedEvidence.source) && Boolean(sourceRunner);

              return (
                <div className="evidence-preview">
                  <div className="evidence-preview-head">
                    <div>
                      <strong>{selectedEvidence.name}</strong>
                      <span>{selectedEvidence.source || "Local evidence"} / {selectedEvidence.kind}</span>
                    </div>
                    <button onClick={() => void createEvidenceRelay(selectedEvidence)}>
                      <Send size={13} />
                      Build review
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
                  <div className="evidence-relay-panel">
                    <div className="evidence-relay-head">
                      <div>
                        <strong>Snapshot relay</strong>
                        <span>{sourceRunner?.session || selectedEvidence.source || "manual source"} {"->"} {reviewerRunner?.session || "reviewer"} {"->"} source</span>
                      </div>
                      <select
                        value={reviewerId}
                        onChange={(event) => updateEvidence(selectedEvidence.id, { reviewerRunnerId: event.target.value })}
                      >
                        <option value="">Choose reviewer</option>
                        {runners.map((runner) => (
                          <option value={runner.id} key={`evidence-reviewer-${selectedEvidence.id}-${runner.id}`}>
                            {runner.session}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={selectedEvidence.note || ""}
                      onChange={(event) => updateEvidence(selectedEvidence.id, { note: event.target.value })}
                      placeholder="Paste OCR, visible error text, or the exact detail the other agent should verify..."
                    />
                    <div className="evidence-relay-actions">
                      <button onClick={() => void createEvidenceRelay(selectedEvidence)}>
                        <Plus size={13} />
                        Build review
                      </button>
                      <button
                        disabled={!!busyRunner || !reviewerRunner || reviewerRunner.state !== "running"}
                        onClick={() => void createEvidenceRelay(selectedEvidence, { send: true })}
                      >
                        <Send size={13} />
                        Send review
                      </button>
                      <button disabled={!!busyRunner || !canRetake || !sourceRunner} onClick={() => sourceRunner && void snapshotRunner(sourceRunner)}>
                        <Camera size={13} />
                        Retake
                      </button>
                    </div>
                  </div>
                  <div className="evidence-paths">
                    {selectedEvidence.path && <span>Windows: {selectedEvidence.path}</span>}
                    {selectedEvidence.wslPath && <span>WSL: {selectedEvidence.wslPath}</span>}
                    {!selectedEvidence.path && !selectedEvidence.wslPath && <span>Browser-local file. Add OCR/context before sending if the reviewer cannot inspect it directly.</span>}
                  </div>
                </div>
              );
            })()}
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
          <div className="onboarding-panel">
            <div className="onboarding-head">
              <div>
                <strong>{setup.onboarding.title}</strong>
                <span>{nextOnboardingStep ? setup.onboarding.subtitle : setup.onboarding.ready}</span>
              </div>
              <em>{completedOnboardingSteps}/{onboardingSteps.length}</em>
            </div>
            <div className="onboarding-list">
              {onboardingSteps.map((step, index) => (
                <div className={cx("onboarding-step", step.status, nextOnboardingStep?.id === step.id && "current")} key={step.id}>
                  <span className="onboarding-index">{step.status === "ok" ? <Check size={13} /> : index + 1}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </div>
                  <button onClick={() => runOnboardingAction(step)}>
                    {copiedSetup === "onboarding-config" && step.id === "config" ? setup.copied : step.action}
                  </button>
                </div>
              ))}
            </div>
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
                <strong>{doctor?.agents?.claude?.selected?.version || doctorById.get("wsl-claude")?.detail?.split("\n").pop() || "not checked"}</strong>
              </div>
              <div>
                <span>Codex</span>
                <strong>{doctor?.agents?.codex?.selected?.version || doctorById.get("wsl-codex")?.detail?.split("\n").pop() || "not checked"}</strong>
              </div>
            </div>
            <div className="parity-grid">
              {parityRows.map((row) => (
                <div className={cx("parity-row", row.status)} key={row.id}>
                  <span>{row.status === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}</span>
                  <div>
                    <strong>{row.label}</strong>
                    <em>{row.value}</em>
                    <small>{row.detail}</small>
                  </div>
                </div>
              ))}
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

        <section className="ops-card project-onboarding-card">
          <div className="panel-head">
            <div>
              <div className="section-label">Project Onboarding</div>
              <h2>Rules & capabilities</h2>
            </div>
            <button className="icon-action" onClick={() => void copyProjectOnboardingBrief()} title="Copy agent brief">
              <Copy size={14} />
            </button>
          </div>
          <p className="setup-subtitle">
            {projectOnboarding
              ? `${projectOnboarding.projectName}: ${projectOnboarding.summary.ok} ok / ${projectOnboarding.summary.warn} warn / ${projectOnboarding.summary.fail} fail`
              : "Refresh to scan project rules, MCP, skills, prompts, plugins, and runner profiles."}
          </p>
          {copiedSetup === "project-onboarding-brief" && <div className="inline-success">Agent brief copied.</div>}

          <div className="onboarding-check-grid">
            {(projectOnboarding?.checks || []).map((item) => (
              <div className={cx("onboarding-check", item.status)} key={item.id}>
                <span>{item.status === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail || item.fix}</small>
                </div>
              </div>
            ))}
            {!projectOnboarding?.checks?.length && <div className="empty-note">No project onboarding scan yet.</div>}
          </div>

          <div className="onboarding-section-title">
            <span>Runner profiles</span>
            <em>{projectOnboarding?.runnerProfiles.length || 0}</em>
          </div>
          <div className="runner-profile-list">
            {(projectOnboarding?.runnerProfiles || []).map((runner) => (
              <div className={cx("runner-profile", runner.status)} key={runner.id}>
                <div>
                  <strong>{runner.name}</strong>
                  <span>{runner.agent} / {runner.mode} / {runner.session}</span>
                </div>
                <small>{runner.detail}</small>
                {!!runner.contextSources.length && <code>{runner.contextSources.join(" + ")}</code>}
              </div>
            ))}
            {!projectOnboarding?.runnerProfiles?.length && <div className="empty-note">Add a Claude Code or Codex CLI runner to see its profile.</div>}
          </div>

          <div className="onboarding-section-title">
            <span>Project context</span>
            <em>{onboardingContextSources.filter((source) => source.exists).length}/{onboardingContextSources.length}</em>
          </div>
          <div className="context-source-list">
            {onboardingContextSources.map((source) => (
              <div className={cx("context-source-row", source.status)} key={source.id}>
                <span>{sourceStatusIcon(source.status)}</span>
                <div>
                  <strong>{source.label}</strong>
                  <small>{source.agent} / {source.kind} / {formatOnboardingSource(source)}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="onboarding-section-title">
            <span>Local MCP / skills / plugins / prompts</span>
            <em>{onboardingLocalItems.length}</em>
          </div>
          <div className="local-capability-list">
            {onboardingLocalItems.map((item) => (
              <div className="local-capability-row" key={`${item.path}-${item.id}`}>
                <strong>{item.label}</strong>
                <small>{item.kind} / {item.detail}</small>
              </div>
            ))}
            {!onboardingLocalItems.length && <div className="empty-note">No local MCP, skills, commands, plugins, or prompts detected yet.</div>}
          </div>
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
            <input data-onboarding-target="project" value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name" />
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
            <div className="runner-mode-row">
              <label>
                <span>Runner mode</span>
                <select
                  value={runnerMode}
                  onChange={(event) => {
                    setRunnerMode(event.target.value as RunnerMode);
                    setRunnerModeTouched(true);
                  }}
                >
                  <option value="wsl">WSL tmux</option>
                  <option value="native">Native tmux</option>
                </select>
              </label>
              <span className={cx("runner-mode-badge", runnerMode === recommendedRunnerMode ? "safe" : "warn")}>
                {runnerMode === recommendedRunnerMode ? "Recommended" : "Manual"}
              </span>
            </div>
            <input data-onboarding-target="runner" value={runnerSession} onChange={(event) => setRunnerSession(event.target.value)} placeholder={runnerPreset.session} />
            <input value={runnerCwd} onChange={(event) => setRunnerCwd(event.target.value)} placeholder={runnerPreset.cwd || "tmux cwd"} />
            <textarea
              value={runnerStartCommand}
              onChange={(event) => setRunnerStartCommand(event.target.value)}
              placeholder={runnerPreset.startCommand}
            />
            <div className="runner-preview">
              <div>
                <span>Host path</span>
                <code>{runnerPreview.hostPath || "No project path"}</code>
              </div>
              <div>
                <span>tmux cwd</span>
                <code>{runnerPreview.cwd || "Not set"}</code>
              </div>
              <div>
                <span>Start command</span>
                <code>{runnerPreview.startCommand || "Not set"}</code>
              </div>
              <div>
                <span>Readiness</span>
                <strong className={cx("runner-readiness", runnerPreview.readinessCheck?.status || "warn")}>
                  {runnerPreview.readinessCheck?.status || "pending"}
                </strong>
              </div>
            </div>
            {[...runnerPreview.blockers, ...runnerPreview.warnings].map((message) => (
              <div className={cx("runner-preview-note", runnerPreview.blockers.includes(message) ? "fail" : "warn")} key={message}>
                {runnerPreview.blockers.includes(message) ? <AlertTriangle size={13} /> : <CircleDot size={13} />}
                <span>{message}</span>
              </div>
            ))}
            <button disabled={!!configBusy || !activeProject || runnerPreview.blockers.length > 0} onClick={() => void addRunnerConfig()}>
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

        <section className="ops-card" data-onboarding-target="doctor">
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

        <section className="ops-card" data-onboarding-target="start">
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
                <span>Send through tmux, confirm risky commands, then auto-peek.</span>
              </div>
              <select value={commandRunner?.id || ""} onChange={(event) => setCommandRunnerId(event.target.value)}>
                {runners.map((runner) => (
                  <option value={runner.id} key={runner.id}>
                    {runner.session}
                  </option>
                ))}
              </select>
            </div>
            <div className="slash-meta-row">
              <span className={cx("slash-risk", slashMeta.risk)}>{slashRiskCopy[slashMeta.risk].label}</span>
              {" "}
              <span>
                {slashRiskCopy[slashMeta.risk].description} Auto-peek after {formatSlashDelay(slashMeta.captureDelayMs)}.
              </span>
            </div>
            <div className="slash-presets">
              {slashCommandPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={cx("slash-preset", preset.risk)}
                  disabled={!!busyRunner || commandRunner?.state !== "running"}
                  title={preset.hint}
                  onClick={() => void sendSlashCommand(preset.command, { source: "panel" })}
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
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendSlashCommand(slashCommand, { source: "panel" });
                  }
                }}
                placeholder="/help, /clear, /compact..."
              />
              <button disabled={!!busyRunner || commandRunner?.state !== "running" || !slashCommand.trim()} onClick={() => void sendSlashCommand(slashCommand, { source: "panel" })}>
                <Send size={13} />
                Send
              </button>
            </div>
            <p>Use Capture first if you are not sure the agent is waiting at an input prompt. Custom commands are passed through exactly.</p>
          </div>
          <pre className="runner-output">{lastRunnerOutput || "Runner output appears here."}</pre>
        </section>
      </aside>
    </main>
  );
}
