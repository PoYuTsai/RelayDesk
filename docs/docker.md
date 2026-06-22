# Docker

Docker is optional. It is useful when you want a reproducible RelayDesk UI/API
server, but it is not the primary path for local agent control.

RelayDesk talks to native tools such as tmux, Claude Code, Codex CLI, terminal
windows, and screen capture. Those tools usually live on the host machine, not
inside the container.

## Recommended Use

Use Docker for:

- trying the UI/API in a clean environment;
- running the production static build and API on one port;
- testing open-source packaging.

Use native `npm run api` + `npm run dev` for:

- controlling host tmux sessions;
- opening terminals;
- capturing desktop windows;
- running Claude Code or Codex CLI from your normal shell environment.

## Run

```bash
docker compose up --build
```

Open:

```text
http://127.0.0.1:8791
```

The container stores local RelayDesk runtime data in `/data`, backed by the
`relaydesk-data` Docker volume.

## Local Config In Docker

By default, Docker falls back to `relay.config.example.json`. If you want a real
local config in Docker, set it through the Project Manager UI or mount a private
data directory that contains `relay.local.json`.

Example:

```yaml
services:
  relaydesk:
    volumes:
      - ../relaydesk-private-data:/data
```

In that private data directory:

```text
relay.local.json
.relaydesk/
```

Do not commit `relay.local.json` or `.relaydesk/`.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `RELAYDESK_HOST` | `127.0.0.1` | Bind address for the API/static server. Docker uses `0.0.0.0`. |
| `RELAYDESK_PORT` | `8791` | API/static server port. |
| `RELAYDESK_DATA_DIR` | repo root | Runtime data directory for `relay.local.json` and `.relaydesk/`. |
| `RELAYDESK_STATIC_DIR` | `dist` | Static UI build directory served by the API server. |

## Limitation

Docker does not magically bridge host tmux, desktop windows, or agent app
sessions. That bridge is intentionally left to host runner adapters, because the
right setup differs across Windows, macOS, and Linux.
