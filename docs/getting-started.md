# Getting Started

This guide is for first-time RelayDesk users.

## 1. Install prerequisites

Install:

- Node.js 20 or newer.
- Git.
- Claude Code CLI and/or Codex CLI.
- tmux.

On Windows, use WSL for tmux runners:

```powershell
wsl --install
```

Inside WSL:

```bash
sudo apt update
sudo apt install -y tmux git
```

Then install or verify your agent CLIs inside WSL:

```bash
claude --version
codex --version
```

## 2. Install RelayDesk

From the RelayDesk folder:

```powershell
npm.cmd install
```

## 3. Create local config

Copy the example:

```powershell
Copy-Item relay.config.example.json relay.local.json
```

Edit `relay.local.json`.

Set:

- `projects[].path`: Windows/macOS/Linux host path.
- `runners[].session`: tmux session name.
- `runners[].tmux.cwd`: path visible inside tmux.
- `runners[].tmux.startCommand`: command used to start the agent.

Windows + WSL path example:

- Windows path: `C:\Users\you\Desktop\MyApp`
- WSL path: `/mnt/c/Users/you/Desktop/MyApp`

Session name example:

- `rc-my-app` for the Claude Code tmux session.
- `rc-codex-my-app` for the Codex CLI tmux session.

`rc` is only a naming convention. It can mean "remote control" or
"RelayDesk-controlled". For a public or team setup, replace `my-app` with your
own project name, such as `rc-<your-project-name>`.

The practical benefit is that a stable tmux session name lets you reconnect
later from RelayDesk, a terminal, or an official remote-control flow as long as
the tmux server is still running on your machine. For example, Claude Code
officially supports `/remote-control` and `/rc`; RelayDesk keeps the same local
session easy to find and control.

## 4. Start RelayDesk

Terminal 1:

```powershell
npm.cmd run api
```

Terminal 2:

```powershell
npm.cmd run dev
```

Open [http://127.0.0.1:5177](http://127.0.0.1:5177).

Production-style local serve:

```powershell
npm.cmd run serve
```

Open [http://127.0.0.1:8791](http://127.0.0.1:8791). This serves the built UI
and API from the same local Node.js process.

Optional Docker UI/API run:

```bash
docker compose up --build
```

Docker is for the RelayDesk UI/API packaging path. Use the native setup above
when you need direct host tmux, terminal, and screen-capture integration.

## 5. Check readiness

Look at the Doctor panel.

You want:

- `0 fail`.
- No missing project paths.
- Claude/Codex available if you configured those runners.
- A passing tmux smoke check for the environment you use.
- Unique tmux session names for every runner.
- `.relaydesk/` and `relay.local.json` ignored by git.

Doctor does more than version checks. When tmux is configured, it creates a
temporary `relaydesk-doctor-*` tmux session, sends a short command, captures the
pane, and kills that temporary session. This verifies that Start, Send, Capture,
and Stop have a real chance of working before you launch a long agent task.

The Setup card can be switched between English and Traditional Chinese. It shows
the same readiness state in a shorter beginner-friendly form, includes a
first-run checklist, and provides copy buttons for common install/config/run
commands.

## 6. Manage projects and sessions

Use Project Manager to edit `relay.local.json` from the browser:

- Add a project name and path.
- Remove a project from RelayDesk config.
- Add a Claude Code, Codex CLI, or custom tmux runner session.
- Pick WSL tmux or native tmux before adding a runner.
- Preview the host path, tmux cwd, and start command before saving.
- Remove runner session config.

Project Manager changes config only. It does not delete folders and does not
kill running tmux sessions.

On Windows, WSL tmux is usually the beginner-friendly choice because the agent
CLI can live inside WSL and RelayDesk can convert `C:\...` paths into
`/mnt/c/...` paths for the runner preview. On macOS/Linux, native tmux is the
normal choice. If you run Windows-native tmux yourself, switch the runner mode
to native and use Windows paths.

## 7. Manage RelayDesk sessions

Use Session Registry near the top of the workspace:

1. Pick an existing session from the selector.
2. Click New before starting a separate task.
3. Let RelayDesk autosave task, step, decisions, evidence, and console output.
4. Click Archive for old work you may want later.
5. Click Delete only when you no longer need that session metadata.

Sessions are stored locally in `.relaydesk/sessions.json`. Deleting a RelayDesk
session does not delete project files, tmux sessions, or saved evidence files.

## 8. Start a runner

In Runner Ops:

1. Click Start on Claude Code or Codex CLI.
2. Click Capture to verify the runner prompt appears.
3. Click Open Terminal if you want the real tmux session in a terminal window.

## 9. Use Session Console

Session Console is the main daily surface for the live tmux pane.

1. Pick a runner from the selector.
2. Click Capture Pane to read the current tmux pane.
3. Turn on Auto refresh if you want RelayDesk to peek at the pane every few seconds.
4. Type a normal follow-up, decision reply, or a slash command supported by that CLI.
5. Press Send.

Auto refresh uses a non-counting peek action. Formal Capture still updates local
activity metrics and can create Decision Inbox items.

If the input starts with `/`, RelayDesk treats it as a slash command. It shows
the command risk level, asks for confirmation when the command can change
context or reset state, sends the exact text to tmux, then auto-peeks the pane.

## 10. Send slash commands

In Session Console or Runner Ops, use Slash command for live CLI commands such
as `/help`, `/clear`, and `/compact`.

RelayDesk sends the command to the selected tmux session and presses Enter.
This is useful when Claude Code or another CLI agent needs context rotation,
clear, resume, or similar command-mode actions.

RelayDesk labels each slash command as Safe read, Context change, State reset,
or Custom. Context-changing, destructive, and custom commands ask for
confirmation first. After sending, RelayDesk waits briefly and peeks the pane so
you can see the immediate CLI response without opening tmux manually.

RelayDesk does not implement slash commands itself. Official commands differ by
agent and version:

- Claude Code: type `/` or `/help`; common examples include `/clear`,
  `/compact`, `/resume`, `/remote-control` or `/rc`, `/diff`, `/code-review`,
  `/status`, and `/usage`.
- Codex CLI: type `/` or check the official docs; common examples include
  `/clear`, `/new`, `/resume`, `/compact`, `/diff`, `/plan`, `/goal`,
  `/review`, `/status`, and `/usage`.

For the fuller operation guide and an official-command snapshot, see
[Slash Commands](slash-commands.md).

Custom commands such as `/round` or `/handoff` are not official RelayDesk,
Claude Code, or Codex CLI built-ins. They only work if you define them in your
own agent skills, prompts, commands, or project setup.

Use Capture first if you are not sure the agent is waiting at an input prompt.

## 11. Send a task

Write a task in Current Task and click Send Task.

For safer workflows:

- Discuss with both agents.
- Pick one builder.
- Let only one agent edit files during Build.
- Let the other agent review the diff.

## 12. Use Decision Inbox

If an agent asks a question:

1. Click Capture.
2. RelayDesk may create a decision card automatically.
3. Choose an option.
4. Set `Source` to the agent that asked the question.
5. Set `Reviewer` to the other agent.
6. Click `Send review` to send the challenge prompt into the reviewer runner.
7. Click `Capture reviewer` after the reviewer answers. RelayDesk appends that
   pane output to the decision note.
8. Edit the final verdict if needed.
9. Click `Return source` to send the final decision back to the source agent.

Relay Bus records the protocol trail for the same session: decision created,
review request sent, local ACK, reviewer capture, verdict returned, and
consensus recorded. This is local session metadata under `.relaydesk/`; it is
not sent to a cloud service by RelayDesk.

## 13. Watch local activity

The Usage / Activity card shows whether RelayDesk is actually moving work:

- Send Task and decision replies increase `sends`.
- Capture increases `captures`.
- Snapshot increases `snapshots` and evidence bytes.
- Runner rows show each runner's last local action.

These numbers are local activity metrics, not provider billing or token counts.

## 14. Use Snapshot

If text capture is not enough:

1. Click Snapshot on the relevant runner.
2. Pick only that agent conversation window.
3. RelayDesk saves the image under `.relaydesk/evidence/`.
4. RelayDesk creates a decision card for second-pass review.
5. In the Evidence preview, choose the reviewer runner.
6. Paste OCR text or a short note if the image is not directly inspectable.
7. Click `Build review` to create another review decision, or `Send review` to
   send it to the reviewer runner immediately.
8. Click `Retake` when the source runner screen changed and the snapshot is stale.

Snapshot v1 does not include bundled OCR. Add manual OCR text or context in the Evidence preview when needed.

## Troubleshooting

`Doctor shows tmux missing`

Install tmux in the same environment where the runner starts.

`Codex starts but shows an update prompt`

Set `dismissCodexUpdatePrompt: true` in that runner's tmux config.

`Start works but Send Task does nothing`

Open Terminal and confirm the agent is at an input prompt.

`Snapshot fails`

Use a browser that supports screen capture on localhost. Chrome and Edge work well.
