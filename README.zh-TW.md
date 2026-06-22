# RelayDesk

<p align="center">
  <strong>Language:</strong>
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-TW.md"><strong>繁體中文</strong></a>
</p>

<p align="center">
  <strong>Docs:</strong>
  <a href="./docs/getting-started.md">Getting Started</a>
  ·
  <a href="./docs/configuration.md">Configuration</a>
  ·
  <a href="./docs/compatibility.md">Compatibility</a>
</p>

> GitHub repo 首頁預設渲染 `README.md`。這份繁中 README 是同步維護的完整翻譯版本。

RelayDesk 是一個本機 agent 工作台，用來協調 Claude Code、Codex CLI 這類原生 AI coding agent。

它不是新的 AI 服務，也不是要取代 Claude、Codex、terminal 或 editor。它做的是把你本來就在用的 agent 放到同一張桌子上：同一個專案、同一個 task、同一份 evidence、同一個決策收件匣，少一點複製貼上。

## 適合誰

如果你常常這樣工作，RelayDesk 就是為你做的：

1. 先跟其中一個 agent 討論想法、規格、TDD 計畫或修 bug 方向。
2. 把 task、decision、screenshot、log 或 snapshot 送給另一個 agent 補盲點。
3. 選一邊當本輪 builder，另一邊當 reviewer、challenger 或第二意見。
4. 當任何一邊問你選項、卡住、或提出不同判斷時，集中到 Decision Inbox。
5. 你做最後決策，再把 verdict 送回需要繼續工作的 agent。

你可以 Codex-first，也可以 Claude-first。RelayDesk 不預設哪一邊比較適合
討論、實作或 review；它只負責把雙向協作、證據和決策整理在同一個本機流程裡。

RelayDesk 的目標是把這個來回變成：

`Capture / Snapshot -> Decision Inbox -> Send to another agent`

## RelayDesk 不是什麼

- 不是雲端 AI 服務。
- 不是 API key proxy。
- 不負責幫你付費或繞過訂閱。
- 不取代 Claude Code、Codex CLI、tmux 或你的 editor。
- 不是把你已經打開的 Codex Desktop 或 Claude Desktop thread 鏡像進來。
- 不會自動把任何東西部署到雲端。

## Agent runner 怎麼理解

RelayDesk 不是新的模型閘道，而是本機 runner cockpit。

- Claude Code runner：啟動你本機的 Claude Code CLI，放在 terminal/tmux session 裡。適合長時間實作、slash command、上下文輪替、remote-control workflow。
- Codex CLI runner：啟動 OpenAI 官方 Codex CLI，並由 RelayDesk 幫它管理 tmux session。它不是你已經打開的 Codex Desktop thread，但會使用你本機的 Codex 安裝、登入狀態和 model config。
- RelayDesk session：保存 task、evidence、decision、runner capture、handoff。它是 workflow layer，不是另一個 AI 模型。

簡單說：RelayDesk 讓原生 Claude Code / Codex CLI 可以在同一個本機流程裡合作，少掉手動複製貼上與截圖搬運。

## 目前 MVP

- 可管理多個本機專案。
- 每個專案都有本機 persistent sessions，存放在 `.relaydesk/sessions.json`。
- 每個專案可配置 Claude Code / Codex CLI tmux runner。
- 工作流程：Discuss、Synthesize、Build、Review、Verify。
- Decision Inbox：收集 agent 問題、選項、你的決策。
- Capture：把 terminal/tmux 裡的問題和選項整理進 Decision Inbox。
- Cross-agent reply：把一邊 agent 的問題整理成可以送給另一邊 agent 的草稿。
- 雙向 relay draft：先請 reviewer 挑戰決策，再把最終 verdict 回給原本的 builder。
- Relay Bus timeline：在每個 session 記錄 message、review request、ACK、capture、verdict、consensus。
- Snapshot：只截你選的 agent 對話視窗，存成本機 evidence，並建立二次確認 decision。
- Evidence tray：放截圖、影片、log、repro material。
- Git 狀態和 diff stat。
- Doctor checks：檢查本機環境、CLI、tmux、專案路徑、gitignore 安全性。
- Project Onboarding：read-only 掃描專案 rules、MCP config、本機 skills/plugins/prompts、runner profile 是否對齊。
- 第一次使用 checklist：用繁中/英文引導新手完成 config、project、runner、Doctor、Start。
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

Docker 可以用單一 port 跑 RelayDesk UI/API，適合乾淨測試與打包；但它不是控制 agent 的主要方式。agent CLI、tmux、視窗截圖、terminal 視窗仍然需要跟你的本機系統互動。

可選的容器流程請看 [Docker](docs/docker.md)。

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

Doctor 也會檢查 agent parity。這很重要，因為 PATH 裡的 `codex`、WSL 裡的
`codex`、以及 Codex Desktop bundled binary 可能是不同版本。如果你想要接近
Codex Desktop 的品質，請使用 Doctor 標成 `gpt-5.5 capable` 的 binary。

Claude Code runner 也會以 tmux 實際啟動的環境為準。在 Windows + WSL 上，通常
是 WSL 裡的 `claude`，不是 Windows 的 `claude.cmd`。目前預設 Claude preset 是
`Claude Opus 4.8 / Ultra Code`，實際命令是：

```bash
claude --model opus --effort xhigh
```

Agent model preset 集中放在 `agent-presets.json`。如果 Claude Code 或 Codex CLI
之後有重大模型或 CLI flag 更新，先改那個檔案，再跑：

```powershell
npm.cmd run check:presets
```

## 基本工作流

1. 選一個專案。
2. 開啟或建立這個專案底下的 RelayDesk session。
3. Start 一個 runner，例如 Claude Code tmux 或 Codex CLI tmux。
4. 在 Current Task 寫下目前任務。
5. Send Task 給其中一邊或兩邊 agent。
6. 用 Session Console 看 live tmux pane，並送追問或決策回覆。
7. 如果 agent 在 terminal 問問題，按 Capture。
8. 如果需要另一邊看畫面，按 Snapshot 並選該 agent 的對話視窗。
9. 在 Decision Inbox 選答案或編輯回覆。
10. Send decision 給另一個 runner。
11. Build 階段只讓一個 agent 寫 code，另一個 agent 做 Review。

## Persistent Sessions

Session Registry 會把目前 task、step、decision、evidence list、選到的 runner、
console output 存到本機。Session 會依專案分開，所以你可以讓不同專案、不同 task
各自保留上下文。

你可以用它：

- 開新 session 來處理新的 task。
- 重新整理或重開 RelayDesk 後回到上一個 project task。
- archive 舊工作但不刪除。
- 刪除已不需要的 RelayDesk session metadata。
- 複製簡短 session brief 給另一個 agent。

Session metadata 會存在 `.relaydesk/sessions.json`，這個路徑已經 gitignore。
刪除 RelayDesk session 不會刪掉 project files、tmux session、或 evidence 圖片檔。

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

- 選一個 runner，例如 `rc-<你的專案名稱>` 或 `rc-codex-<你的專案名稱>`。
- 按 Capture Pane，把目前 terminal pane 拉進 RelayDesk。
- 開 Auto refresh，RelayDesk 會每幾秒 peek 一次 pane，但不會算成正式 Capture。
- 可以送一般文字、task 追問、decision reply，或 CLI slash command。
- 需要原生 terminal 時，仍可按 Open。

送出時會真的打進 tmux session 並按 Enter。送之前先看 pane 狀態，確認 agent 已回到可輸入 prompt。

在這裡輸入 slash command 會走跟 Runner Ops 一樣的保護流程：RelayDesk 會先標示風險，對會改變上下文、重置狀態、或未知自訂指令跳確認，送出後再自動 peek 一次 tmux pane。

## 為什麼範例叫 `rc-*`？

`rc` 只是範例命名慣例，可以理解成 remote control 或 RelayDesk-controlled；它不是 tmux 的必要功能，也不是綁定某個人的專案名稱。

公開文件裡建議用這種模板：

- `rc-<你的專案名稱>`：該專案的 Claude Code runner。
- `rc-codex-<你的專案名稱>`：該專案的 Codex CLI runner。

使用固定 tmux session 名稱的原因是：只要你的電腦上 tmux server 還開著，你就可以之後從另一個 terminal、RelayDesk、或官方 remote-control 流程重新 attach 到同一個 Claude Code / Codex CLI session。

例如 Claude Code 官方有 `/remote-control` 和 `/rc`，可以把本機 session 開給 Claude 網頁端接續使用。RelayDesk 本身不負責把 tmux tunnel 到網路上；它做的是管理你本機已經跑起來的 session，讓你少貼來貼去。

命名範例：

- `rc-my-app`：`my-app` 的 Claude Code runner。
- `rc-codex-my-app`：`my-app` 的 Codex CLI runner。

## Slash Commands

Runner Ops 裡有 Slash command 面板。RelayDesk 不會自己實作這些指令，只會把文字送進目前選到的 live CLI session。

面板會把指令標成 Safe read、Context change、State reset、Custom。Context change、State reset、Custom 會先跳確認，確認後才真的送進 tmux 並按 Enter；送完會短暫等待，然後自動 peek 一次 pane，讓你確認 CLI 是否有接到。

官方指令會依 agent 與版本不同而變。最準的方法是在目標 CLI 裡輸入 `/` 或 `/help`，看你當下環境支援哪些命令。

常見官方例子：

- Claude Code：`/help`、`/clear`、`/compact`、`/resume`、`/remote-control` 或 `/rc`、`/diff`、`/code-review`、`/status`、`/usage`。
- Codex CLI：`/clear`、`/new`、`/resume`、`/compact`、`/diff`、`/plan`、`/goal`、`/review`、`/status`、`/usage`。

`/round`、`/handoff` 這類指令不是 RelayDesk 或官方 provider 內建；它們比較像個人或專案自訂 workflow。如果你自己用 custom commands、skills、prompts、或專案設定定義它們，RelayDesk 仍然可以把它們送進對應 CLI。

官方文件：

- RelayDesk slash command guide: [docs/slash-commands.md](docs/slash-commands.md)
- Claude Code commands: <https://code.claude.com/docs/en/commands>
- Codex CLI slash commands: <https://developers.openai.com/codex/cli/slash-commands>

如果不確定 agent 是否已經回到輸入 prompt，先按 Capture 看狀態；agent 還在跑時
先不要送 `/clear`、`/compact` 或其他會改變 session 狀態的指令。

## Decision Relay

每張 Decision Inbox card 都有兩種 draft builder：

- `Ask reviewer`：把目前問題、選項、task、風險提示整理給另一個 agent 挑戰。
- `Return verdict`：把最後決策整理回原本的 source agent，讓它用最小範圍繼續。

每張 card 也可以指定 relay route：

- `Source`：原本問問題、或接下來要繼續做事的 agent。
- `Reviewer`：負責挑戰這個決策的另一個 agent。

主要流程是：

- `Send review`：把 review request 真的送進 reviewer 的 tmux runner。
- `Capture reviewer`：擷取 reviewer 目前 tmux pane，附加到 decision note。
- `Return source`：把最後 verdict 送回 source runner。

你仍然可以先手動修改 draft 再送。RelayDesk 會標示 open、reviewing、reviewed、returned，讓雙向 handoff 不會靠記憶追蹤。

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
- 選擇 WSL tmux 或 native tmux，並預覽會儲存的 cwd / command。
- 移除 runner session 設定。

從 Project Manager 移除專案或 runner，只會改 `relay.local.json`，不會刪除你的專案資料夾，也不會 kill 正在跑的 tmux session。live process 請用 Runner Ops 控制。

WSL tmux runner 範例：

```json
{
  "id": "claude-code",
  "name": "Claude Code tmux",
  "kind": "tmux",
  "session": "rc-my-app",
  "tmux": {
    "mode": "wsl",
    "cwd": "/mnt/c/path/to/MyApp",
    "startCommand": "bash -lc 'cd /mnt/c/path/to/MyApp && claude --model opus --effort xhigh'"
  }
}
```

如果你的 Claude Code build 還不支援 `--effort xhigh`，可以先用 `--effort max`，
或升級 tmux runner 實際會啟動的 Claude Code CLI。

Codex CLI runner 範例：

```json
{
  "id": "codex-cli",
  "name": "Codex CLI tmux",
  "kind": "tmux",
  "session": "rc-codex-my-app",
  "tmux": {
    "mode": "wsl",
    "cwd": "/mnt/c/path/to/MyApp",
    "startCommand": "bash -lc 'cd /mnt/c/path/to/MyApp && codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox -C /mnt/c/path/to/MyApp'",
    "dismissCodexUpdatePrompt": true
  }
}
```

如果 Doctor 顯示 WSL 或 PATH 上的 Codex CLI 比 Codex Desktop bundled binary 舊，
請更新該 CLI，或在 runner command 裡明確指向較新的 binary。否則 RelayDesk 上
的 Codex runner 可能無法達到你預期的 Desktop-quality model access。

Stop / Restart 這類動作會先跳確認，避免誤殺 session。

## Snapshot 隱私

Snapshot v1 預設保存完整截圖，不會自動遮罩 email、路徑或 log。這是刻意設計，因為你的使用場景通常需要另一個 agent 看完整上下文。

截圖存好後，Evidence preview 會變成 relay 操作區：

- 選 reviewer runner。
- 如果圖片不能被 agent 直接讀，貼上 OCR 文字或補充說明。
- 建立 review decision，或直接送進 reviewer runner。
- 如果畫面過期，可以從同一個 source runner 重新截圖。

截圖會存到 `.relaydesk/evidence/`，這個資料夾已經 gitignore。

## 文件

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Docker](docs/docker.md)
- [Slash Commands](docs/slash-commands.md)
- [Compatibility](docs/compatibility.md)
- [Release Checklist](docs/release-checklist.md)
- [Open Source Roadmap](docs/open-source-roadmap.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## CI 與公開安全

GitHub Actions 會跑 `npm ci`、`npm run check:public`、
`node --check server/relay-server.mjs`、`npm run build`。

`npm run check:public` 會掃 tracked files，避免把本機私人路徑、個人 email、
常見 API key 形狀或 bearer token 推到公開 repo。它不掃已忽略的本機 runtime
檔案，例如 `relay.local.json` 或 `.relaydesk/`。

公開 release 前也建議跑 `npm run check:release`，它會檢查必要文件、gitignore、example config，以及 public scan。

## 安全提醒

RelayDesk 是 local-first，但你送給 agent 的文字和截圖仍可能進入該 agent 供應商的服務範圍。請確認你的訂閱、資料政策和公司規範。

如果你要把 fork 或 repo 開源，請先跑 release checklist，確認沒有 commit 本機 config、log、截圖、credentials 或私人專案路徑。
