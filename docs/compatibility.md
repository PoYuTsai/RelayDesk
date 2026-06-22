# Compatibility

RelayDesk depends on local tools that can change over time. Keep compatibility explicit.

## Tested locally

| Component | Tested version/status |
| --- | --- |
| OS | Windows + WSL2 |
| Node.js | v22.16.0 |
| Git | 2.50.0.windows.1 |
| WSL kernel | Linux 6.6.87.2-microsoft-standard-WSL2 |
| tmux | 3.4 |
| Claude Code in WSL | 2.1.183 |
| Claude Code on Windows PATH | 2.1.87 |
| Codex CLI in WSL | 0.132.0 |
| Codex CLI on Windows PATH | 0.118.0 |
| Codex Desktop bundled CLI | 0.142.0-alpha.6 |
| Docker | Optional UI/API packaging path |

## Adapter notes

## Doctor checks

The Doctor panel is the fastest compatibility check for a new machine or after a
Claude Code / Codex CLI / tmux update. It checks:

- config source and parse status;
- `.gitignore` protection for local config, evidence, and logs;
- Git availability;
- WSL and/or native tmux availability;
- a real temporary tmux smoke session;
- Claude Code and Codex CLI availability when configured;
- Claude/Codex CLI parity hints for stream-json, Opus 4.8 Ultra Code, Codex
  `exec --json`, and whether the selected binaries are new enough for the
  target latest-model workflow;
- PATH shadowing, where an older `codex` on PATH differs from the newer Codex
  Desktop bundled binary;
- project paths and per-runner `tmux.cwd`;
- duplicate tmux session names.

The tmux smoke check creates a temporary `relaydesk-doctor-*` session, sends a
short command, captures the pane, then kills the temporary session. It should not
touch your configured agent sessions.

### Claude Code

Claude Code is treated as a tmux runner. RelayDesk can start, stop, capture, send text, and open an attached terminal.

For WSL/tmux runners, Doctor treats WSL `claude` as the primary Claude Code
binary because that is what tmux actually launches. Windows `claude.cmd` is
still shown as a native candidate, but it should not be used to infer WSL runner
quality.

The default high-capability preset is labeled `Claude Opus 4.8 / Ultra Code`.
It maps to:

```bash
claude --model opus --effort xhigh
```

Claude Code v2.1.154 or newer is required for Opus 4.8. If `xhigh` is not
accepted by your installed CLI, use `--effort max` as a fallback until the
runner's Claude Code is upgraded.

Recommended:

- Keep project-specific Claude setup outside the repo.
- Use `relay.local.json` for local runner commands.
- Avoid committing auth state, channels, or private plugin config.

### Codex CLI

Codex CLI is treated as a tmux runner.

Important: "Codex is installed" is not enough for parity. A machine can have
multiple Codex entrypoints:

- a Windows PATH `codex.cmd`;
- a WSL `codex` used by tmux runners;
- a Codex Desktop bundled `codex.exe` recorded in `~/.codex/config.toml`.

These can be different versions. RelayDesk Doctor now reports the selected
binary, PATH default, WSL runner version, `exec --json` support, and whether the
selected version is new enough for the `gpt-5.5` workflow. If WSL uses an older
Codex than Desktop, the WSL runner may not match the quality or model access of
the desktop app.

Recommended flags for tmux:

```bash
codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox -C /path/to/project
```

`--no-alt-screen` makes capture-pane easier to read.

`dismissCodexUpdatePrompt` can skip the startup update prompt when Codex asks whether to update now.

For desktop-parity testing, point a runner command or `RELAYDESK_CODEX_PATH` at
the newest Codex binary that Doctor marks as `gpt-5.5 capable`. Do this
deliberately: RelayDesk should make the active entrypoint visible instead of
silently replacing your local runner setup.

## Version policy

RelayDesk should prefer minimum supported versions over exact pins.

Agent model presets are centralized in `agent-presets.json`. When Claude Code or
Codex CLI changes model aliases, effort levels, JSON output flags, or minimum
versions, update that preset file first. Server Doctor checks, Project Manager
defaults, example config, and release checks should then stay aligned.

When an agent CLI changes:

1. Update `agent-presets.json` if model, effort, flag, or minimum-version assumptions changed.
2. Run `npm run check:presets`.
3. Run Doctor checks.
4. Start the runner.
5. Capture the prompt.
6. Send a small test message.
7. Stop the runner.
8. Update this compatibility file if behavior changed.

## Known limitations

- Usage/token metrics are local activity metrics unless the agent exposes official usage data.
- Snapshot OCR is not bundled yet.
- Docker serves the UI/API and stores runtime data through `RELAYDESK_DATA_DIR`,
  but host runner control and screen capture still require host integration.
