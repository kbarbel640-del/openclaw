---
summary: 「完全解除安裝 OpenClaw（CLI、服務、狀態、工作區）」
read_when:
  - 您想要從機器上移除 OpenClaw
  - 解除安裝後 Gateway 閘道器 服務仍在執行
title: 「解除安裝」
x-i18n:
  source_path: install/uninstall.md
  source_hash: 6673a755c5e1f90a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:46Z
---

# 解除安裝

有兩種路徑：

- **簡易路徑**：若 `openclaw` 仍已安裝。
- **手動移除服務**：若 CLI 已不在，但服務仍在執行。

## 簡易路徑（CLI 仍已安裝）

建議：使用內建的解除安裝程式：

```bash
openclaw uninstall
```

非互動式（自動化 / npx）：

```bash
openclaw uninstall --all --yes --non-interactive
npx -y openclaw uninstall --all --yes --non-interactive
```

手動步驟（結果相同）：

1. 停止 Gateway 閘道器 服務：

```bash
openclaw gateway stop
```

2. 解除安裝 Gateway 閘道器 服務（launchd/systemd/schtasks）：

```bash
openclaw gateway uninstall
```

3. 刪除狀態 + 設定：

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
```

如果您將 `OPENCLAW_CONFIG_PATH` 設為狀態目錄之外的自訂位置，也請刪除該檔案。

4. 刪除您的工作區（選用，會移除代理程式檔案）：

```bash
rm -rf ~/.openclaw/workspace
```

5. 移除 CLI 安裝（選擇您使用的方式）：

```bash
npm rm -g openclaw
pnpm remove -g openclaw
bun remove -g openclaw
```

6. 如果您安裝了 macOS 應用程式：

```bash
rm -rf /Applications/OpenClaw.app
```

注意事項：

- 如果您使用了設定檔（`--profile` / `OPENCLAW_PROFILE`），請針對每個狀態目錄重複步驟 3（預設為 `~/.openclaw-<profile>`）。
- 在遠端模式中，狀態目錄位於 **Gateway 閘道器 主機** 上，因此也請在該處執行步驟 1–4。

## 手動移除服務（未安裝 CLI）

若 Gateway 閘道器 服務持續執行，但缺少 `openclaw`，請使用此方式。

### macOS（launchd）

預設標籤為 `bot.molt.gateway`（或 `bot.molt.<profile>`；舊版 `com.openclaw.*` 可能仍存在）：

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

如果您使用了設定檔，請將標籤與 plist 名稱替換為 `bot.molt.<profile>`。若存在任何舊版 `com.openclaw.*` plist，請一併移除。

### Linux（systemd 使用者單元）

預設單元名稱為 `openclaw-gateway.service`（或 `openclaw-gateway-<profile>.service`）：

```bash
systemctl --user disable --now openclaw-gateway.service
rm -f ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload
```

### Windows（排程工作）

預設工作名稱為 `OpenClaw Gateway`（或 `OpenClaw Gateway (<profile>)`）。
工作指令碼位於您的狀態目錄之下。

```powershell
schtasks /Delete /F /TN "OpenClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclaw\gateway.cmd"
```

如果您使用了設定檔，請刪除相對應的工作名稱與 `~\.openclaw-<profile>\gateway.cmd`。

## 一般安裝 vs 原始碼檢出

### 一般安裝（install.sh / npm / pnpm / bun）

如果您使用了 `https://openclaw.ai/install.sh` 或 `install.ps1`，CLI 會以 `npm install -g openclaw@latest` 安裝。
請使用 `npm rm -g openclaw` 移除（若以該方式安裝，則使用 `pnpm remove -g` / `bun remove -g`）。

### 原始碼檢出（git clone）

如果您從儲存庫檢出執行（`git clone` + `openclaw ...` / `bun run openclaw ...`）：

1. **在**刪除儲存庫之前解除安裝 Gateway 閘道器 服務（使用上方的簡易路徑或手動移除服務）。
2. 刪除儲存庫目錄。
3. 依上述方式移除狀態 + 工作區。
