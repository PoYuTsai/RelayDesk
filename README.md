# RelayDesk

RelayDesk is a local cockpit for coordinating native AI coding agents such as
Claude Code and Codex CLI.

It does not replace your agents, subscriptions, terminal, or editor. It gives
them a shared desk: project context, runner controls, decision handoffs,
conversation snapshots, evidence files, git state, and setup checks.

Traditional Chinese README: [README.zh-TW.md](README.zh-TW.md)

## Who This Is For

RelayDesk is for developers who often use more than one coding agent and are
tired of copying text, screenshots, and decisions between windows.

Example flow:

1. Ask Claude Code to investigate a bug.
2. Capture Claude's question or screenshot.
3. Send the decision or snapshot to Codex for a second opinion.
4. Send Codex's challenge back to Claude.
5. Let only one agent write code while the other reviews the diff.

## What RelayDesk Is Not

- Not a hosted AI service.
- Not an API-key proxy.
- Not a billing layer.
- Not a replacement for Claude Code, Codex, tmux, or your editor.
- Not a cloud orchestrator. The app runs locally on your machine.

## Current MVP

- Project registry with multiple local projects.
- Persistent per-project sessions stored locally under `.relaydesk/sessions.json`.
- Claude Code and Codex CLI tmux runners for each project.
- Workflow steps: Discuss, Synthesize, Build, Review, Verify.
- Decision Inbox for agent questions, options, and user decisions.
- Capture-to-Inbox parsing for numbered questions from terminal agents.
- Cross-agent reply drafts to send a decision to another runner.
- Two-way relay draft builders: ask a reviewer to challenge a decision, then
  return the final verdict to the source agent.
- Per-runner conversation Snapshot that saves a selected agent window as local
  evidence and creates a review decision.
- Evidence tray for screenshots, videos, logs, and repro material.
- Git status and diff stat panel.
- Doctor checks for local setup readiness and release-safety ignores.
- First-run setup checklist with English and Traditional Chinese copy.
- Local usage/activity visibility for messages, captures, snapshots, sessions,
  and rough output size.

## Requirements

Minimum:

- Node.js 20 or newer.
- Git.
- At least one supported local agent CLI.

For terminal runner workflows:

- `tmux`.
- Claude Code CLI and/or Codex CLI.
- Valid auth/subscription/API access for the agents you use.

Windows users:

- WSL is recommended for tmux runners.
- Windows Terminal is recommended for opening attached tmux sessions.

macOS/Linux users:

- Native `tmux` can be used with `tmux.mode: "native"`.

Docker note:

Docker can run the RelayDesk UI/API on one port for clean testing and packaging,
but it is not the primary path for controlling agents. Agent CLIs, tmux,
terminal windows, and screen capture still need host integration.

See [Docker](docs/docker.md) for the optional container workflow.

## Quick Start

Install dependencies:

```powershell
npm.cmd install
```

Copy the example config:

```powershell
Copy-Item relay.config.example.json relay.local.json
```

Edit `relay.local.json` and set your project paths and runner commands.

Start the API server:

```powershell
npm.cmd run api
```

Start the web UI in a second terminal:

```powershell
npm.cmd run dev
```

Open [http://127.0.0.1:5177](http://127.0.0.1:5177).

Then check the Doctor panel in the right sidebar. It should show whether your
config, project paths, tmux, Claude Code, and Codex CLI are ready.

## Basic Workflow

1. Select a project.
2. Open or create a RelayDesk session for that project.
3. Start a runner, such as `Claude Code tmux` or `Codex CLI tmux`.
4. Enter the current task.
5. Send the task to one or both runners.
6. Use Session Console to read the live tmux pane and send follow-up input.
7. Use Capture to pull terminal text into the Decision Inbox.
8. Use Snapshot to capture the current agent conversation window as evidence.
9. Choose or edit a decision.
10. Send that decision to another runner.
11. Keep one writer during Build and use the other agent for Review.

## Persistent Sessions

Session Registry saves the current task, step, decisions, evidence list,
selected runner, and console output to local disk. Sessions are scoped per
project, so you can keep separate Vibe Coding workspaces without mixing context.

Use it to:

- create a fresh session before starting a new task;
- switch back to a previous project task after reload;
- archive old work without deleting it;
- delete RelayDesk session metadata when a task no longer matters;
- copy a compact session brief for another agent.

Session metadata is stored in `.relaydesk/sessions.json`, which is gitignored.
Deleting a RelayDesk session does not delete project files, tmux sessions, or
evidence image files.

## Agent Trust Bar

The top workspace strip keeps the important safety state visible:

- the active writer for this round;
- whether git/disk is clean or changed;
- each runner's live state;
- local sends, captures, and snapshots;
- the latest RelayDesk action per runner.

RelayDesk does not show fake cost, token, or cache-hit numbers. Those can be
added later only when an agent exposes official usage metadata.

## Session Console

Session Console is the main in-browser surface for live tmux interaction.

- Select a runner, such as `rc-<project-name>` or `rc-codex-<project-name>`.
- Click Capture Pane to pull the current terminal pane into RelayDesk.
- Turn on Auto refresh to peek at the pane every few seconds without counting it
  as a formal capture.
- Send normal text, task follow-ups, decision replies, or slash commands into
  the selected tmux prompt.
- Open Terminal remains available when you need the native tmux session.

Commands are sent to the real tmux session and press Enter. Use the visible pane
state to confirm the agent is waiting at a prompt before sending input.

Slash commands entered here use the same guarded passthrough as Runner Ops:
RelayDesk classifies the command, asks for confirmation before context-changing
or destructive commands, sends the exact text to tmux, then auto-peeks the pane.

## Why `rc-*` Session Names?

`rc` is only a naming convention in the example config. It can mean "remote
control" or "RelayDesk-controlled"; it is not a required tmux feature and it is
not tied to one user's project.

The pattern is:

- `rc-<your-project-name>` for the Claude Code runner.
- `rc-codex-<your-project-name>` for the Codex CLI runner.

The reason to keep a stable tmux session name is that you can leave a tmux
server running on your computer, then later attach to that same Claude Code or
Codex CLI session from another terminal, RelayDesk, or an official
remote-control flow. For example, Claude Code has `/remote-control` and `/rc` to
make a local session available from Claude on the web. RelayDesk itself does not
tunnel tmux over the internet; it coordinates the local sessions you already
run.

Example naming:

- `rc-my-app`: Claude Code runner for `my-app`.
- `rc-codex-my-app`: Codex CLI runner for `my-app`.

## Slash Commands

Runner Ops includes a Slash command panel. RelayDesk does not implement these
commands itself; it sends the text into the selected live CLI session.

The panel labels commands as Safe read, Context change, State reset, or Custom.
Context-changing, destructive, and unknown custom commands ask for confirmation
before RelayDesk presses Enter. After any slash command is sent, RelayDesk waits
briefly and peeks the tmux pane so you can see the CLI's immediate response.

Official commands depend on the agent and version. Use `/help` or type `/` in
the target CLI to see what is available in your environment.

Common official examples:

- Claude Code: `/help`, `/clear`, `/compact`, `/resume`, `/remote-control`
  or `/rc`, `/diff`, `/code-review`, `/status`, `/usage`.
- Codex CLI: `/clear`, `/new`, `/resume`, `/compact`, `/diff`, `/plan`,
  `/goal`, `/review`, `/status`, `/usage`.

Custom commands such as `/round` or `/handoff` are not RelayDesk or provider
built-ins. They can still work if you define them through your agent's custom
commands, skills, prompts, or project setup.

References:

- RelayDesk slash command guide: [docs/slash-commands.md](docs/slash-commands.md)
- Claude Code commands: <https://code.claude.com/docs/en/commands>
- Codex CLI slash commands: <https://developers.openai.com/codex/cli/slash-commands>

Use Capture first when you are not sure the agent is waiting at an input prompt.
If the agent is still executing, wait until the prompt returns before sending a
slash command.

## Decision Relay

Each Decision Inbox card has two draft builders:

- `Ask reviewer`: formats the current question, selected answer, task, and risk
  prompt for the other agent.
- `Return verdict`: formats the final decision back to the source agent so it can
  continue with a minimal, scoped next step.

Each card also has a route selector:

- `Source`: the agent that originally asked the question or will continue work.
- `Reviewer`: the other agent that should challenge the decision.

The three relay actions are:

- `Send review`: sends the review request to the reviewer runner.
- `Capture reviewer`: captures the reviewer tmux pane and appends it to the
  decision note.
- `Return source`: sends the final verdict back to the source runner.

You can still edit the draft before sending. RelayDesk tracks whether the card is
open, reviewing, reviewed, or returned so the handoff loop is visible.

## Usage / Activity

RelayDesk shows local relay activity in the right sidebar:

- messages sent through RelayDesk;
- captures pulled from tmux;
- snapshots saved as local evidence;
- rough output size and evidence bytes;
- runner-level last action time.

This is intentionally not a fake billing dashboard. It does not estimate Claude
or Codex subscription cost unless an agent exposes official usage data in the
future.

## Runner Config

`relay.local.json` is private and gitignored. The API server only runs commands
defined by your local config.

You can edit common config from the Project Manager card:

- add a project path;
- remove a project from RelayDesk config;
- add Claude Code, Codex CLI, or custom tmux runner sessions;
- remove runner session config.

Removing a project or runner from Project Manager does not delete project files
and does not kill a running tmux session. Use Runner Ops for live process
control.

Recommended WSL tmux runner:

```json
{
  "id": "claude-code",
  "name": "Claude Code tmux",
  "kind": "tmux",
  "session": "rc-my-app",
  "tmux": {
    "mode": "wsl",
    "cwd": "/mnt/c/path/to/MyApp",
    "startCommand": "bash -lc 'cd /mnt/c/path/to/MyApp && claude'"
  }
}
```

Codex CLI runner with startup prompt handling:

```json
{
  "id": "codex-cli",
  "name": "Codex CLI tmux",
  "kind": "tmux",
  "session": "rc-codex-my-app",
  "tmux": {
    "mode": "wsl",
    "cwd": "/mnt/c/path/to/MyApp",
    "startCommand": "bash -lc 'cd /mnt/c/path/to/MyApp && codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox -C /mnt/c/path/to/MyApp'",
    "dismissCodexUpdatePrompt": true
  }
}
```

For destructive actions such as Stop and Restart, the UI asks for confirmation
before the backend runs the allowlisted command.

## Snapshot Privacy

Snapshot v1 saves full screenshots without automatic redaction. This is
intentional for local debugging: the other agent often needs the complete
conversation context.

After a snapshot is saved, the Evidence preview becomes the relay surface:

- select the reviewer runner;
- paste OCR text or a short note when the image is not directly inspectable;
- build a review decision or send it to the reviewer runner immediately;
- retake the snapshot from the same source runner when the capture is stale.

Saved snapshots go under `.relaydesk/evidence/`, which is gitignored.

## Documentation

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Docker](docs/docker.md)
- [Slash Commands](docs/slash-commands.md)
- [Compatibility](docs/compatibility.md)
- [Release Checklist](docs/release-checklist.md)
- [Open Source Roadmap](docs/open-source-roadmap.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## CI And Public Safety

GitHub Actions runs `npm ci`, `npm run check:public`,
`node --check server/relay-server.mjs`, and `npm run build`.

`npm run check:public` scans tracked files for private local paths, personal
email addresses, common API key shapes, and bearer tokens. It does not scan
ignored local runtime files such as `relay.local.json` or `.relaydesk/`.

Before a public release, also run `npm run check:release` for required docs,
gitignore, example-config, and public-scan checks.

## Security

RelayDesk is local-first, but it can still send sensitive text or screenshots to
the agents you run. Review your agent subscriptions, data controls, and company
policies before using it with private code.

Before publishing a fork or public repo, run the release checklist and verify
that no local config, logs, screenshots, credentials, or private project paths
are committed.
