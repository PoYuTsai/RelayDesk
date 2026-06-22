# Agent Workflows

RelayDesk coordinates native local agents. It should make Claude-first and
Codex-first workflows feel equally natural, without pretending to mirror an
already-open desktop app thread.

## Core objects

- Workspace: one local project path.
- RelayDesk session: one task-level work record. It stores task text,
  decisions, evidence, captures, relay events, and builder/reviewer roles.
- Runner: one controllable local agent process, usually a tmux session.
- Agent thread: the native conversation state inside a runner.

RelayDesk session and agent thread are not the same thing. One RelayDesk session
can coordinate multiple agent threads, such as one Claude Code builder thread
and one Codex reviewer thread.

## Claude Code workflow

Claude Code is terminal-first in RelayDesk.

Expected shape:

1. The user configures a stable tmux session such as `rc-my-app`.
2. `tmux.entryCommand` can point at an existing shell function or alias, such as
   `rc-my-app`.
3. Enter/Open Terminal runs that entry command and puts the user into the real
   Claude Code terminal.
4. Start/Restart can create the detached tmux session from `tmux.startCommand`.
5. Send, slash commands, Capture Pane, Snapshot, and Kill operate on that same
   tmux session.

Claude Code remains the source of truth for its own context, slash commands,
subagents, remote-control flow, plugins, skills, and MCP behavior. RelayDesk
routes text, screenshots, decisions, and captured terminal state to the native
session.

## Codex workflow

Codex in RelayDesk is a managed Codex CLI runbox.

It is not the same thread as an already-open Codex Desktop chat window. Users
should understand the difference clearly:

- Codex Desktop: the official desktop app thread the user may already be using.
- Codex CLI runner: an official local Codex CLI process controlled by
  RelayDesk, usually in tmux.
- Codex parity: achieved by using the same logged-in local setup, the newest
  capable Codex binary, and the desired model/config, not by attaching to a
  private desktop-app thread.

RelayDesk should make Codex CLI feel desktop-like where the CLI supports it:

1. Start a new Codex agent thread for a task.
2. Resume or attach to an existing Codex CLI thread/session.
3. Show the active Codex thread in the left sidebar beside Claude Code threads.
4. Let the user type normal instructions, slash commands, review requests, and
   guidance messages into the selected Codex thread.
5. Capture visible output and stream structured events when the CLI exposes
   them.
6. Keep a RelayDesk transcript of what was sent, captured, reviewed, and
   decided.

The goal is not to clone Codex Desktop pixel-for-pixel. The goal is to preserve
the daily behavior users care about: multi-thread work, fast review, editable
handoffs, project-aware context, screenshots/evidence, and human decisions in
one local desk.

## Thread model

The left sidebar should eventually show:

- Projects.
- RelayDesk sessions for the selected project.
- Agent threads under the selected RelayDesk session.

Suggested thread actions:

- New thread.
- Resume/open thread.
- Rename.
- Archive.
- Delete local RelayDesk metadata.
- Copy brief.
- Send current task.
- Capture latest output.
- Snapshot current conversation window.

Claude Code and Codex should share this interaction model even if their native
backends differ:

- Claude Code backend: tmux session plus Claude Code slash commands.
- Codex backend: Codex CLI tmux session, Codex CLI resume/new commands, and
  structured JSON/event output when available.

## Guidance and interruption

RelayDesk needs a first-class guidance action. This is the replacement for
copying text between desktop windows.

Expected behavior:

1. The user selects an agent thread.
2. The user types a message in the RelayDesk composer.
3. RelayDesk labels whether the message is a task, decision reply, review
   request, slash command, or guidance/interruption.
4. RelayDesk sends the exact text to the selected live runner.
5. RelayDesk records a timeline event and optionally peeks/captures the runner
   output.

Guidance is intentionally simple. It is user text inserted into the native agent
conversation at the moment the user chooses. RelayDesk should not invent a
hidden planner that silently changes agent behavior.

## Decision loop

The product should support either direction:

- Codex-first: discuss or design with Codex, hand the result to Claude Code to
  build, then ask Codex to review.
- Claude-first: spec/TDD/build with Claude Code, ask Codex to review, then send
  the final human decision back to Claude Code.

When agents disagree, RelayDesk should not force fake consensus. It should:

1. Capture both positions.
2. Show agreement, disagreement, missing evidence, and risk.
3. Ask the human for the final decision.
4. Send the verdict back to whichever agent needs to continue.

## Implementation backlog

Priority order:

1. Agent Thread Registry in the left sidebar.
2. Codex runbox adapter: create/resume/open/archive local Codex CLI threads.
3. Claude Code thread parity: show one or more CC tmux sessions under the same
   thread model.
4. Unified composer: send task, guidance, decision replies, slash commands, and
   review requests to any selected thread.
5. Streaming/capture model: show live CLI output, structured events when
   available, and non-counting peek versus formal capture.
6. Evidence routing: screenshot/OCR/video evidence can be attached to a task and
   sent to a selected agent thread.
7. Handoff summary: one-click brief from any thread/session to another agent.
8. Compatibility guardrails: Doctor verifies selected Claude/Codex binary,
   model capability, auth, tmux, project rules, MCP, skills, plugins, prompts,
   and slash-command support.

This backlog is the bridge between RelayDesk as a tmux cockpit and RelayDesk as
the daily two-agent desk.
