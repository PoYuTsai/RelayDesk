# Configuration

RelayDesk reads runner configuration from `relay.local.json` first. If that file does not exist, it falls back to `relay.config.example.json`.

`relay.local.json` is private and must not be committed.

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
    "startCommand": "bash -lc 'cd /mnt/c/path/to/MyProject && claude'"
  }
}
```

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
