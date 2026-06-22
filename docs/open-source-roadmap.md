# RelayDesk Open Source Roadmap

RelayDesk is meant to become a local agent bus for people who already use native coding agents such as Claude Code and Codex. This document captures product and release concerns before the project is published as an open source repository.

## 1. Cross-platform support

Goal: a new user should be able to run RelayDesk on Windows, macOS, and Linux without rewriting project config.

Recommended direction:

- Keep the web UI and API server cross-platform Node.js.
- Treat agent runners as adapters:
  - `tmux-wsl` for Windows users who run agents inside WSL.
  - `tmux-native` for macOS/Linux users.
  - future `desktop-bridge` for Claude Desktop/Codex Desktop snapshot workflows.
- Keep `relay.local.json` gitignored and provide only `relay.config.example.json`.
- Provide platform-specific setup guides:
  - Windows + WSL + Windows Terminal.
  - macOS + Homebrew + tmux.
  - Linux + tmux.

Docker recommendation:

- Docker is useful for the RelayDesk API/UI and reproducible development.
- Docker should not be the only supported path because local agents, tmux, screen/window capture, and desktop apps need host integration.
- Best open-source shape:
  - `npm run dev` as the primary local path.
  - optional `docker compose up` for UI/API only.
  - host runner adapters remain outside Docker.

Current v1:

- `Dockerfile` and `docker-compose.yml` run the built UI/API on one port.
- `RELAYDESK_DATA_DIR` moves local runtime data outside the repo root for
  container use.
- Docker remains UI/API only by default; host tmux and desktop capture still use
  native adapters.

Open-source release checklist:

- Verify `.gitignore` excludes `relay.local.json`, `.relaydesk/`, logs, env files, screenshots, and generated evidence.
- Search for local paths, emails, tokens, API keys, project IDs, and private screenshots before publishing.
- Ensure README never includes real user credentials or private repo paths.
- Run `npm run check:release` before tagging or publishing a public release.

## 2. Beginner onboarding

Target user: a vibe coding beginner who already wants Claude/Codex help but does not want to copy/paste between windows.

The README should be plain-language and task-oriented:

- What RelayDesk is: a local cockpit for two coding agents.
- What RelayDesk is not: not a hosted AI service, not an API-key proxy, not a replacement for Claude/Codex.
- Requirements:
  - Node.js.
  - Git.
  - One or more agent CLIs, such as Claude Code and/or Codex CLI.
  - tmux for terminal runner workflows.
  - WSL on Windows if using Linux tmux from Windows.
  - Active accounts/subscriptions/API access according to each agent's own requirements.
- First run:
  - install dependencies.
  - copy config example.
  - set project paths.
  - start API.
  - start UI.
  - start a runner.
  - send a task.

Setup UX to add later:

- First-run setup wizard in the browser.
- Project path picker.
- Runner health checks:
  - `node` found.
  - `git` found.
  - `tmux` found.
  - `claude` found.
  - `codex` found.
  - project path exists.
- A "Copy working config" button that writes local config only after user confirmation.

Current v1:

- `/api/doctor` returns local readiness checks.
- The web UI shows a Doctor panel with ok/warn/fail counts and actionable details.
- The web UI includes a bilingual Setup card for quick start commands, setup readiness, and compatibility summary.
- Project Manager can add/remove projects and tmux runner session config in `relay.local.json`.

Language support:

- Add i18n before public release if the target audience includes both Traditional Chinese and English users.
- Start with `en` and `zh-TW`.
- Keep README English-first for GitHub discoverability, then add `README.zh-TW.md`.
- UI language switch should affect visible labels, onboarding text, and help copy.

Current i18n scope:

- `en` and `zh-TW` switch exists for the Setup card.
- Existing product workflow labels remain English until the copy map is expanded.
- Documentation exists in English and Traditional Chinese README form.

## 3. Agent and CLI compatibility

Problem: Claude Code, Codex CLI, models, flags, prompts, and auth flows will change over time.

Recommended direction:

- Version runner adapters separately from UI features.
- Add a compatibility matrix:
  - RelayDesk version.
  - Claude Code version tested.
  - Codex CLI version tested.
  - Node.js version tested.
  - OS tested.
- Add `doctor` checks:
  - CLI exists.
  - CLI version.
  - auth status if available.
  - tmux can create/capture/kill a smoke session.
  - runner startup prompt detection.
- Avoid hardcoding model names in core logic.
- Make runner commands configurable and documented.
- Keep startup prompt workarounds behind config flags, such as `dismissCodexUpdatePrompt`.

Maintenance workflow:

- Pin minimum supported versions, not exact versions, where possible.
- Keep adapters defensive: fail with readable messages when a CLI changes.
- Add smoke tests for:
  - start runner.
  - capture runner.
  - send text.
  - open terminal.
  - stop runner.
  - snapshot evidence save.

## 4. Usage and token visibility

The original Code-Duo-style idea surfaced usage/cost/token information. RelayDesk should preserve the useful part without pretending to own billing.

Recommended direction:

- Keep "usage visibility" as a first-class panel.
- Track local RelayDesk activity:
  - sessions started.
  - messages sent to each runner.
  - captures taken.
  - snapshots saved.
  - rough output size.
  - task duration.
- If an agent exposes official usage data, show it as "reported by agent".
- If usage is estimated, label it clearly as "local estimate".
- Avoid showing fake cost numbers.

Suggested UI:

- Per runner:
  - status.
  - current session.
  - messages sent.
  - captures.
  - snapshots.
  - last active time.
- Per task:
  - timeline.
  - evidence count.
  - decisions created/sent.
  - builder/reviewer assignment.
  - final verdict.

Open question:

- Should RelayDesk try to parse token/cost lines from CLI output, or only expose official usage APIs/CLI metadata when available?

Recommendation:

- Start with local activity metrics.
- Add parser-based token/cost only as optional, clearly marked best-effort telemetry.

Current v1:

- `/api/usage` reports in-memory local activity for this RelayDesk API process.
- The UI shows sends, captures, snapshots, evidence bytes, and per-runner last action.
- Session Console can peek at live tmux panes without incrementing capture counts.
- Metrics reset when the API server restarts.
- No token or cost numbers are shown unless a future official agent metadata source is added.

## 5. Conversation snapshot workflow

Goal: capture only the current agent conversation, not the whole desktop, then send it to another agent for second-pass review.

Current v1:

- Per-runner `Snapshot` button.
- User picks the relevant agent conversation/window in the browser capture picker.
- RelayDesk saves the image locally under `.relaydesk/evidence/`.
- RelayDesk creates a Decision Inbox item with a cross-agent review draft.
- No automatic redaction by default.

Future improvements:

- OCR extraction for the captured conversation image.
- Snapshot preview before sending.
- Retake snapshot action.
- Optional redaction mode for public demos or GitHub issues.
- Send snapshot + OCR + task context to a selected runner.
- Attach snapshot to the task timeline and final review history.
