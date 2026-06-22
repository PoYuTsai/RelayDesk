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
| Claude Code | 2.1.183 |
| Codex CLI | 0.132.0 |

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
- project paths and per-runner `tmux.cwd`;
- duplicate tmux session names.

The tmux smoke check creates a temporary `relaydesk-doctor-*` session, sends a
short command, captures the pane, then kills the temporary session. It should not
touch your configured agent sessions.

### Claude Code

Claude Code is treated as a tmux runner. RelayDesk can start, stop, capture, send text, and open an attached terminal.

Recommended:

- Keep project-specific Claude setup outside the repo.
- Use `relay.local.json` for local runner commands.
- Avoid committing auth state, channels, or private plugin config.

### Codex CLI

Codex CLI is treated as a tmux runner.

Recommended flags for tmux:

```bash
codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox -C /path/to/project
```

`--no-alt-screen` makes capture-pane easier to read.

`dismissCodexUpdatePrompt` can skip the startup update prompt when Codex asks whether to update now.

## Version policy

RelayDesk should prefer minimum supported versions over exact pins.

When an agent CLI changes:

1. Run Doctor checks.
2. Start the runner.
3. Capture the prompt.
4. Send a small test message.
5. Stop the runner.
6. Update this compatibility file if behavior changed.

## Known limitations

- Usage/token metrics are local activity metrics unless the agent exposes official usage data.
- Snapshot OCR is not bundled yet.
- Docker is not the primary runtime because runner control and screen capture require host integration.
