# RelayDesk

RelayDesk 是一個本機 agent 工作台，用來協調 Claude Code、Codex CLI 這類原生 AI coding agent。

它不是新的 AI 服務，也不是要取代 Claude、Codex、terminal 或 editor。它做的是把你本來就在用的 agent 放到同一張桌子上：同一個專案、同一個 task、同一份 evidence、同一個決策收件匣，少一點複製貼上。

English README: [README.md](README.md)

## 適合誰

如果你常常這樣工作，RelayDesk 就是為你做的：

1. 先跟 Codex 討論想法。
2. 把結論複製到 Claude Code 執行。
3. Claude Code 問你選項或卡住。
4. 你截圖回來問 Codex。
5. 再把 Codex 的意見貼回 Claude Code。

RelayDesk 的目標是把這個來回變成：

`Capture / Snapshot -> Decision Inbox -> Send to another agent`

## RelayDesk 不是什麼

- 不是雲端 AI 服務。
- 不是 API key proxy。
- 不負責幫你付費或繞過訂閱。
- 不取代 Claude Code、Codex CLI、tmux 或你的 editor。
- 不會自動把任何東西部署到雲端。

## 目前 MVP

- 可管理多個本機專案。
- 每個專案可配置 Claude Code / Codex CLI tmux runner。
- 工作流程：Discuss、Synthesize、Build、Review、Verify。
- Decision Inbox：收集 agent 問題、選項、你的決策。
- Capture：把 terminal/tmux 裡的問題和選項整理進 Decision Inbox。
- Cross-agent reply：把一邊 agent 的問題整理成可以送給另一邊 agent 的草稿。
- Snapshot：只截你選的 agent 對話視窗，存成本機 evidence，並建立二次確認 decision。
- Evidence tray：放截圖、影片、log、repro material。
- Git 狀態和 diff stat。
- Doctor checks：檢查本機環境、CLI、tmux、專案路徑、gitignore 安全性。
- Usage/activity：追蹤本機送出、capture、snapshot、session 等活動量。

## 前置需求

最低需求：

- Node.js 20 或更新版本。
- Git。
- 至少一個支援的 agent CLI。

如果要使用 terminal runner：

- `tmux`。
- Claude Code CLI 或 Codex CLI。
- 你自己的 Claude / Codex 帳號、訂閱或 API access。

Windows 使用者：

- 建議使用 WSL 來跑 tmux runner。
- 建議安裝 Windows Terminal，方便開啟 attached tmux session。

macOS / Linux 使用者：

- 可以用原生 `tmux`，並在 config 裡設定 `tmux.mode: "native"`。

Docker 說明：

Docker 可以讓 UI/API 環境更穩，但目前不建議當唯一使用方式。因為 agent CLI、tmux、視窗截圖、terminal 視窗都需要跟你的本機系統互動。

## 快速開始

安裝 dependencies：

```powershell
npm.cmd install
```

複製 config 範本：

```powershell
Copy-Item relay.config.example.json relay.local.json
```

編輯 `relay.local.json`，把 project path 和 runner command 改成你的本機路徑。

啟動 API server：

```powershell
npm.cmd run api
```

開另一個 terminal 啟動前端：

```powershell
npm.cmd run dev
```

打開 [http://127.0.0.1:5177](http://127.0.0.1:5177)。

進去後先看右側的 Doctor panel。它會告訴你：

- config 是否正常。
- project path 是否存在。
- git 是否可用。
- WSL / tmux 是否可用。
- Claude Code / Codex CLI 是否找得到。
- `.gitignore` 是否保護本機 config 和 evidence。

## 基本工作流

1. 選一個專案。
2. Start 一個 runner，例如 Claude Code tmux 或 Codex CLI tmux。
3. 在 Current Task 寫下目前任務。
4. Send Task 給其中一邊或兩邊 agent。
5. 用 Session Console 看 live tmux pane，並送追問或決策回覆。
6. 如果 agent 在 terminal 問問題，按 Capture。
7. 如果需要另一邊看畫面，按 Snapshot 並選該 agent 的對話視窗。
8. 在 Decision Inbox 選答案或編輯回覆。
9. Send decision 給另一個 runner。
10. Build 階段只讓一個 agent 寫 code，另一個 agent 做 Review。

## Agent Trust Bar

Workspace 上方的狀態列會固定顯示本輪最重要的安全資訊：

- 目前誰是 active writer。
- git / disk 目前是乾淨或已有變更。
- 每個 runner 是 running 還是 stopped。
- 本機 sends、captures、snapshots 次數。
- 每個 runner 最近一次 RelayDesk action。

RelayDesk 不會顯示假的 cost、token、cache hit。未來只有在 agent 提供官方 usage metadata 時，才會把那些數字加回來。

## Session Console

Session Console 是日常操作 live tmux 的主入口。

- 選一個 runner，例如 `rc-vibesync` 或 `rc-codex-vibesync`。
- 按 Capture Pane，把目前 terminal pane 拉進 RelayDesk。
- 開 Auto refresh，RelayDesk 會每幾秒 peek 一次 pane，但不會算成正式 Capture。
- 可以送一般文字、task 追問、decision reply，或 `/round`、`/clear`、`/resume`。
- 需要原生 terminal 時，仍可按 Open。

送出時會真的打進 tmux session 並按 Enter。送之前先看 pane 狀態，確認 agent 已回到可輸入 prompt。

## Slash Commands

Runner Ops 裡有 Slash command 面板，可以直接送 `/round`、`/clear`、
`/resume` 這類 CLI 指令。

這些指令會透過 RelayDesk 的 runner send path 送進目前選到的 live tmux
session，不是瀏覽器假動作。

如果不確定 agent 是否已經回到輸入 prompt，先按 Capture 看狀態；agent 還在跑時
先不要送 `/clear` 或 `/resume`。

## Usage / Activity

右側欄位會顯示本機 relay 活動：

- 透過 RelayDesk 送出的訊息數。
- 從 tmux 擷取的 Capture 次數。
- 存成 evidence 的 Snapshot 次數。
- 粗略 output 大小與 evidence 檔案大小。
- 每個 runner 最後一次活動時間。

這不是假的帳單或 token 面板。RelayDesk 目前只統計本機動作；未來如果 Claude
或 Codex 官方 CLI 有提供 usage metadata，才會標示成 agent reported usage。

## Runner Config

`relay.local.json` 是你的私有設定，已經在 `.gitignore` 裡，不應該 commit。

你可以在 Project Manager 卡片處理常見設定：

- 新增專案路徑。
- 從 RelayDesk 設定移除專案。
- 新增 Claude Code、Codex CLI、custom tmux runner session。
- 移除 runner session 設定。

從 Project Manager 移除專案或 runner，只會改 `relay.local.json`，不會刪除你的專案資料夾，也不會 kill 正在跑的 tmux session。live process 請用 Runner Ops 控制。

WSL tmux runner 範例：

```json
{
  "id": "claude-code",
  "name": "Claude Code tmux",
  "kind": "tmux",
  "session": "rc-vibesync",
  "tmux": {
    "mode": "wsl",
    "cwd": "/mnt/c/path/to/project",
    "startCommand": "bash -lc 'cd /mnt/c/path/to/project && claude'"
  }
}
```

Codex CLI runner 範例：

```json
{
  "id": "codex-cli",
  "name": "Codex CLI tmux",
  "kind": "tmux",
  "session": "rc-codex-vibesync",
  "tmux": {
    "mode": "wsl",
    "cwd": "/mnt/c/path/to/project",
    "startCommand": "bash -lc 'cd /mnt/c/path/to/project && codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox -C /mnt/c/path/to/project'",
    "dismissCodexUpdatePrompt": true
  }
}
```

Stop / Restart 這類動作會先跳確認，避免誤殺 session。

## Snapshot 隱私

Snapshot v1 預設保存完整截圖，不會自動遮罩 email、路徑或 log。這是刻意設計，因為你的使用場景通常需要另一個 agent 看完整上下文。

截圖會存到 `.relaydesk/evidence/`，這個資料夾已經 gitignore。

## 文件

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Compatibility](docs/compatibility.md)
- [Release Checklist](docs/release-checklist.md)
- [Open Source Roadmap](docs/open-source-roadmap.md)

## 安全提醒

RelayDesk 是 local-first，但你送給 agent 的文字和截圖仍可能進入該 agent 供應商的服務範圍。請確認你的訂閱、資料政策和公司規範。

如果你要把 fork 或 repo 開源，請先跑 release checklist，確認沒有 commit 本機 config、log、截圖、credentials 或私人專案路徑。
