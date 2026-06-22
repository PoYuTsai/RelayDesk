# Contributing

Thanks for helping improve RelayDesk.

## Local Setup

```bash
npm ci
npm run build
node --check server/relay-server.mjs
npm run check:public
```

For daily development, run the API and UI in separate terminals:

```bash
npm run api
npm run dev
```

## Local-First Rules

- Do not commit `relay.local.json`.
- Do not commit `.relaydesk/`, screenshots, logs, private paths, or credentials.
- Keep runner commands generic in docs and examples.
- Use `rc-<your-project-name>` style placeholders instead of real private tmux
  session names.
- If a change touches tmux, runner control, screenshots, or config loading, run
  Doctor locally before opening a PR.

## Pull Requests

- Keep one concern per PR.
- Include the user-facing workflow you tested.
- Include `npm run build`, `node --check server/relay-server.mjs`, and
  `npm run check:public` results.
- For UI changes, include desktop and mobile smoke evidence.
