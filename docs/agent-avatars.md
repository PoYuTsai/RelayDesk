# Agent Avatars

RelayDesk keeps its clean-room agent avatars in:

- `public/assets/agents/claude-code.svg`
- `public/assets/agents/codex.svg`
- `public/assets/agents/ai-room.svg`

These files are local UI assets for RelayDesk. They are not copied from Discord
webhook settings, Claude, OpenAI, or any private AI Room deployment.

## Discord Webhooks

Discord webhook avatars live in Discord unless you send an `avatar_url` with the
webhook payload.

If your AI Room bridge reads variables such as:

- `AI_ROOM_CODEX_WEBHOOK_URL`
- `AI_ROOM_CC_WEBHOOK_URL`
- `AI_ROOM_ROOM_WEBHOOK_URL`
- `AI_ROOM_CODEX_AVATAR_URL`
- `AI_ROOM_CC_AVATAR_URL`
- `AI_ROOM_ROOM_AVATAR_URL`

then the `*_AVATAR_URL` values must be public image URLs that Discord can fetch.
Local URLs such as `http://127.0.0.1:8791/assets/agents/codex.svg` are useful in
the browser, but Discord cannot fetch them from your machine.

For Discord, either:

1. upload the avatar manually in Discord:
   `Channel Settings -> Integrations -> Webhooks -> select webhook -> avatar`, or
2. publish these assets somewhere public and set the matching `*_AVATAR_URL`.

The shared AI Room avatar intentionally uses a teal/indigo background instead of
black so it remains visible in dark Discord and dark RelayDesk UI.
