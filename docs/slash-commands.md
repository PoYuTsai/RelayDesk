# Slash Commands

RelayDesk does not emulate slash commands. It sends the exact text you type to
the selected live tmux session and presses Enter. The command is then handled by
Claude Code, Codex CLI, or whichever CLI is running in that pane.

## Safe Operation

1. Select the runner in Session Console or Runner Ops.
2. Click Capture Pane if you are not sure whether the CLI is waiting at a prompt.
3. Type the slash command, for example `/help` or `/compact`.
4. Check the RelayDesk risk label.
5. Press Send.
6. Confirm the prompt when RelayDesk marks the command as context-changing,
   destructive, or custom.
7. Read the automatic peek result after the command is sent.

RelayDesk classifies slash commands before sending:

- Safe read: common read-only commands such as `/help`, `/status`, `/usage`, or
  `/diff`. These send without an extra confirmation prompt.
- Context change: commands such as `/compact`, `/resume`, `/round`, or
  `/handoff` that may rotate, summarize, or resume context.
- State reset: commands such as `/clear`, `/new`, `/delete`, `/archive`,
  `/quit`, or `/exit` that can reset or leave the live CLI session.
- Custom: any slash command RelayDesk does not recognize. It is still passed
  through exactly, but confirmation is required because behavior depends on your
  local agent setup.

After any slash command is sent, RelayDesk waits briefly and peeks the selected
tmux pane. This readback is not a full formal Capture, but it gives immediate
feedback that the CLI saw the command.

Do not send `/clear`, `/new`, `/delete`, `/archive`, `/quit`, `/exit`, or other
state-changing commands while the agent is still executing a task.

## Official Source Of Truth

Command availability depends on product version, platform, plan, and runtime
mode. The complete current catalog should always be checked in the official CLI:

- Type `/` inside the running CLI to open the local command picker.
- Type `/help` where supported.
- Claude Code commands: <https://code.claude.com/docs/en/commands>
- Codex CLI slash commands: <https://developers.openai.com/codex/cli/slash-commands>

The command names below are a convenience snapshot last checked on 2026-06-22.
They may not all appear for every user.

## Claude Code

Common daily commands:

- `/help`: show available commands.
- `/clear [name]`: start a new conversation with empty context.
- `/compact [instructions]`: summarize the current conversation to free context.
- `/resume [session]`: resume a previous conversation.
- `/remote-control` or `/rc`: make the local session available from Claude on
  the web.
- `/diff`: inspect uncommitted changes.
- `/code-review [effort] [--fix] [--comment] [target]`: review the current diff.
- `/review [PR]`: review a pull request locally.
- `/status`: show settings/status information.
- `/usage`: show session cost and usage statistics.
- `/model [model]`: switch model.
- `/effort [level|auto]`: adjust reasoning effort.
- `/permissions`: manage tool permission rules.
- `/mcp`: manage MCP server connections.
- `/memory`: edit Claude memory files and memory settings.
- `/doctor`: diagnose Claude Code installation and settings.
- `/debug [description]`: enable debug logging and troubleshoot.
- `/exit` or `/quit`: exit the CLI or detach an attached background session.

Other official commands listed by Claude Code docs include:

`/add-dir`, `/advisor`, `/agents`, `/autofix-pr`, `/background`, `/batch`,
`/branch`, `/btw`, `/cd`, `/chrome`, `/claude-api`, `/color`, `/config`,
`/context`, `/copy`, `/cost`, `/deep-research`, `/desktop`, `/export`, `/fast`,
`/feedback`, `/fewer-permission-prompts`, `/focus`, `/fork`, `/goal`,
`/heapdump`, `/hooks`, `/ide`, `/init`, `/insights`, `/install-github-app`,
`/install-slack-app`, `/keybindings`, `/login`, `/logout`, `/loop`, `/mobile`,
`/passes`, `/plan`, `/plugin`, `/powerup`, `/privacy-settings`, `/radio`,
`/recap`, `/release-notes`, `/reload-plugins`, `/reload-skills`, `/remote-env`,
`/rename`, `/rewind`, `/run`, `/run-skill-generator`, `/sandbox`, `/schedule`,
`/scroll-speed`, `/security-review`, `/setup-bedrock`, `/setup-vertex`,
`/simplify`, `/skills`, `/stats`, `/statusline`, `/stickers`, `/stop`,
`/tasks`, `/team-onboarding`, `/teleport`, `/terminal-setup`, `/theme`, `/tui`,
`/ultraplan`, `/ultrareview`, `/upgrade`, `/usage-credits`, `/verify`,
`/voice`, `/web-setup`, and `/workflows`.

Some commands are aliases, conditional, plan-gated, platform-specific, or
available only on certain Claude plans.

### Remote Control on Windows + WSL

If your Claude Code runner is configured with `tmux.mode: "wsl"`, RelayDesk is
controlling the Claude Code CLI inside WSL. A successful Windows PowerShell
login such as `claude.cmd auth login` does not always prove that the WSL tmux
session has an active Remote Control token.

When the Claude pane shows `Remote Control failed · /login`, use the same live
pane:

1. Send `/login`.
2. Choose `1. Claude account with subscription` for Pro, Max, Team, or
   Enterprise accounts.
3. Finish the browser authorization.
4. Send `/remote-control` or `/rc` again.

After Claude Code prints `Remote Control active`, Claude Desktop should show the
Remote project in its Code sidebar.

## Codex CLI

Common daily commands:

- `/`: show the command picker where available.
- `/clear`: clear the terminal and start a fresh chat.
- `/new`: start a new conversation inside the same CLI session.
- `/resume`: resume a saved conversation.
- `/compact`: summarize the visible conversation to free tokens.
- `/diff`: show the Git diff, including untracked files.
- `/plan`: switch to plan mode and optionally send a prompt.
- `/goal`: set, view, pause, resume, or clear a task goal.
- `/review`: ask Codex to review the working tree.
- `/status`: display session configuration and token usage.
- `/usage`: view account token usage or rate-limit reset options.
- `/model`: choose the active model and reasoning effort where available.
- `/permissions`: adjust what Codex can do without asking first.
- `/mcp`: list configured MCP tools.
- `/skills`: browse and use local skills.
- `/ps`: show experimental background terminals.
- `/stop`: stop background terminals.
- `/quit` or `/exit`: exit the CLI.

Other official commands listed by Codex CLI docs include:

`/archive`, `/delete`, `/copy`, `/experimental`, `/approve`, `/memories`,
`/import`, `/feedback`, `/init`, `/logout`, `/mention`, `/fast`,
`/personality`, `/fork`, `/side` or `/btw`, `/raw`, `/debug-config`,
`/statusline`, `/title`, `/theme`, `/keymap`, `/apps`, `/plugins`, `/hooks`,
`/agent`, `/ide`, `/vim`, and `/sandbox-add-read-dir`.

Some commands are unavailable while a task is running, inside side conversations,
in remote sessions, or on unsupported platforms.

## Custom Commands

`/round`, `/handoff`, and similar workflow shortcuts are not official RelayDesk,
Claude Code, or Codex CLI built-ins. They can still work through RelayDesk if
you define them in your agent's own custom command, skill, prompt, or project
configuration system.
