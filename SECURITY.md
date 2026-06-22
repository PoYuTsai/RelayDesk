# Security Policy

RelayDesk is local-first. It can still handle sensitive data because users may
send code, terminal output, screenshots, logs, and prompts into local agent CLIs.

## Supported Versions

Security fixes target the latest `main` branch until formal releases exist.

## Reporting

Please do not paste secrets, private screenshots, local config, or full logs into
public issues.

If GitHub private vulnerability reporting is enabled for this repository, use
that channel. Otherwise, open a minimal public issue that describes the affected
area without sensitive data, and maintainers can arrange a private exchange.

## Maintainer Checklist

- Keep `relay.local.json`, `.relaydesk/`, logs, and `.env` ignored.
- Run `npm run check:public` before publishing.
- Do not add hosted proxy behavior without an explicit security review.
- Treat screenshot, evidence, and terminal capture features as sensitive by
  default.
