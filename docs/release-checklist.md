# Release Checklist

Run this before publishing RelayDesk or pushing a public repository.

## 1. Local files

Verify these are not tracked:

- `relay.local.json`
- `.relaydesk/`
- `*.log`
- `.env`
- screenshots
- generated evidence
- private project notes

## 2. Secret scan

Search for private material:

```powershell
Select-String -Path * -Pattern "api_key|apikey|secret|token|password|bearer|sk-" -Recurse -ErrorAction SilentlyContinue
```

Search for local personal paths:

```powershell
Select-String -Path * -Pattern "C:\\Users\\|/Users/|/home/" -Recurse -ErrorAction SilentlyContinue
```

Review matches manually. Example config may contain placeholder paths, but real paths should not be in public docs unless intentionally generic.

## 3. Git state

```powershell
git status --short
git diff --stat
```

Review every changed file before publishing.

## 4. Build and API checks

```powershell
npm.cmd run build
node --check server/relay-server.mjs
npm.cmd run check:presets
npm.cmd run check:public
npm.cmd run check:release
```

Start the API and verify:

```powershell
npm.cmd run api
```

Open:

- `http://127.0.0.1:8791/api/health`
- `http://127.0.0.1:8791/api/doctor`
- `http://127.0.0.1:8791/api/onboarding?projectId=<your-project-id>`

Confirm Doctor reports:

- tmux smoke check ran for the configured environment.
- runner session names are unique.
- every configured runner cwd exists.
- Claude/Codex preset parity matches `agent-presets.json`.

## 5. Browser smoke

Start UI:

```powershell
npm.cmd run dev
```

Verify:

- Projects load.
- Doctor panel loads.
- Project Onboarding panel loads and shows project rules, MCP, local
  skills/plugins/prompts, and runner profiles.
- Runner cards render.
- Decision Inbox renders.
- Evidence tray renders.
- Snapshot button is visible.
- No private image or log is shown by default.

Production-style local serve:

```powershell
npm.cmd run serve
```

Open `http://127.0.0.1:8791` and repeat the same smoke checks.

Optional Docker packaging smoke:

```bash
docker compose up --build
```

Open `http://127.0.0.1:8791`. Confirm the UI/API loads. Do not treat this as a
host tmux integration test unless you intentionally mounted and configured host
runner access.

## 6. Public repo hygiene

Before creating the GitHub repo:

- Confirm the repo name and description.
- Confirm license.
- Confirm README and README.zh-TW are ready.
- Confirm Docker docs are clear that Docker is UI/API only by default.
- Confirm no local-only config is tracked.
- Confirm GitHub Actions CI exists and runs the public scan.
- Confirm screenshots in docs are safe for public use.

## 7. Optional GitHub setup

Suggested public repo settings:

- Add topics: `ai-agents`, `claude-code`, `codex`, `tmux`, `local-first`, `developer-tools`.
- Enable issues.
- Add a security policy if users may report sensitive bugs.
- Add a first release only after a clean local smoke test.
