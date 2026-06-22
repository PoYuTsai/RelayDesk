# Configuration

RelayDesk reads runner configuration from `relay.local.json` first. If that file does not exist, it falls back to `relay.config.example.json`.

`relay.local.json` is private and must not be committed.

By default, runtime data is stored in the repository root. Set
`RELAYDESK_DATA_DIR` to move `relay.local.json` and `.relaydesk/` elsewhere,
for example when running in Docker.

Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `RELAYDESK_HOST` | `127.0.0.1` | API/static server bind address. |
| `RELAYDESK_PORT` | `8791` | API/static server port. |
| `RELAYDESK_DATA_DIR` | repo root | Runtime data directory. |
| `RELAYDESK_STATIC_DIR` | `dist` | Static UI build directory served by the API server. |
| `RELAYDESK_CLAUDE_PATH` | PATH lookup | Preferred native Claude Code binary for Doctor parity checks. WSL/tmux runners are checked against WSL `claude`. |
| `RELAYDESK_CODEX_PATH` | Codex Desktop config, then PATH lookup | Preferred Codex binary for Doctor parity checks. |

`RELAYDESK_CODEX_PATH` does not rewrite your runner command. It tells Doctor
which Codex binary to evaluate first. If you want a tmux runner to use that same
binary, put the explicit path in `tmux.startCommand`.

## Agent presets

Model, effort, minimum-version, and label defaults live in
`agent-presets.json`. Update that file first when Claude Code or Codex CLI
ships a major model or flag change, then run:

```powershell
npm.cmd run check:presets
```

The current defaults target `Claude Opus 4.8 / Ultra Code` for Claude Code and
`gpt-5.5` for Codex. The Doctor panel and Project Manager runner defaults read
from the same preset file so the UI and backend do not drift.

## Project Onboarding scan

Project Onboarding is a read-only scan. It helps a user confirm whether
RelayDesk can see the same local context their native agents already use.

For the selected project, RelayDesk checks common project-level sources:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.mcp.json`
- `.claude/mcp.json`
- `.claude/mcp_servers/`
- `.claude/settings.json`
- `.claude/commands/`
- `.claude/skills/`
- `.claude/agents/`
- `.codex/config.toml`
- `.codex/mcp.json`
- `.codex/mcp_servers/`
- `.codex/rules/`
- `.codex/skills/`
- `.codex/prompts/`
- `.cursor/rules/`

It also checks user-level agent homes on the host, and WSL homes when WSL is
available:

- `~/.claude/settings.json`
- `~/.claude/mcp.json`
- `~/.claude/mcp_servers/`
- `~/.claude/skills/`
- `~/.claude/commands/`
- `~/.claude/agents/`
- `~/.claude/plugins/`
- `~/.codex/config.toml`
- `~/.codex/mcp.json`
- `~/.codex/mcp_servers/`
- `~/.codex/skills/`
- `~/.codex/plugins/`
- `~/.codex/prompts/`

The scan does not edit those files. It reports whether rules, MCP config,
skills, plugins, prompts, commands, subagents, and runner profiles are visible
enough for Claude Code and Codex CLI to behave like the user's existing local
setup.

## Project shape

```json
{
  "projects": [
    {
      "id": "my-project",
      "name": "My Project",
      "path": "C:\\path\\to\\MyProject",
      "runners": []
    }
  ]
}
```

Fields:

- `id`: stable lowercase identifier.
- `name`: display name in the UI.
- `path`: host path used by Git and non-tmux commands.
- `runners`: agent runner definitions.

## tmux runner

```json
{
  "id": "claude-code",
  "name": "Claude Code tmux",
  "kind": "tmux",
  "session": "rc-my-project",
  "tmux": {
    "mode": "wsl",
    "cwd": "/mnt/c/path/to/MyProject",
    "startCommand": "bash -lc 'cd /mnt/c/path/to/MyProject && claude --model opus --effort xhigh'"
  }
}
```

RelayDesk labels this preset as `Claude Opus 4.8 / Ultra Code`. The label is a
RelayDesk preset; the actual Claude Code command is:

```bash
claude --model opus --effort xhigh
```

If your local Claude Code does not support `xhigh`, use `--effort max` or
upgrade the CLI used by the tmux runner.

Fields:

- `kind`: currently `tmux`.
- `session`: tmux session name.
- `tmux.mode`: `wsl` or `native`.
- `tmux.cwd`: working directory inside tmux.
- `tmux.hostCwd`: optional host-side cwd for launching commands.
- `tmux.startCommand`: allowlisted command used by Start/Restart.
- `tmux.dismissCodexUpdatePrompt`: optional Codex startup prompt workaround.

`rc-*` is only a convention used by the examples. It is short for
remote-control/RelayDesk-controlled and helps you remember that the tmux session
is meant to stay attachable from RelayDesk or another terminal.

For public documentation or a team template, use names like
`rc-<your-project-name>` and `rc-codex-<your-project-name>` instead of a private
project name. Claude Code's `/remote-control` and `/rc` are official commands,
but a tmux session name such as `rc-my-project` is still just your local naming
choice.

The Project Manager form writes these same fields. It recommends `wsl` on
Windows and `native` elsewhere, then shows the host project path, the tmux cwd
that will be saved, and the exact start command before you add the runner.

## Windows + WSL

Use:

```json
"mode": "wsl"
```

The API will call:

```text
wsl.exe --exec tmux ...
```

Use WSL paths in `tmux.cwd` and inside `startCommand`.
For example, `C:\Users\you\Desktop\MyApp` becomes
`/mnt/c/Users/you/Desktop/MyApp` in the runner preview.

## macOS/Linux

Use:

```json
"mode": "native"
```

The API will call:

```text
tmux ...
```

Use native paths.

## Safety model

The browser never sends arbitrary shell commands. It sends action names such as:

- `start`
- `stop`
- `restart`
- `capture`
- `send`
- `open`

The backend maps those actions to allowlisted runner config.

## Private files

Keep these out of git:

- `relay.local.json`
- `.relaydesk/`
- `*.log`
- `.env`
- screenshots and generated evidence

`.relaydesk/sessions.json` contains local RelayDesk session metadata. It can
include task text, decision notes, evidence paths, and captured console output,
so it must stay private.
