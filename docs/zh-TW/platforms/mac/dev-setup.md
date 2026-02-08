---
summary: 「為開發 OpenClaw macOS 應用程式的開發者提供的設定指南」
read_when:
  - 設定 macOS 開發環境
title: 「macOS 開發設定」
x-i18n:
  source_path: platforms/mac/dev-setup.md
  source_hash: 4ea67701bd58b751
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:04Z
---

# macOS 開發者設定

本指南涵蓋從原始碼建置並執行 OpenClaw macOS 應用程式所需的必要步驟。

## 先決條件

在建置應用程式之前，請確認已安裝以下項目：

1.  **Xcode 26.2+**：Swift 開發所需。
2.  **Node.js 22+ 與 pnpm**：Gateway 閘道器、CLI 與封裝指令碼所需。

## 1. 安裝相依套件

安裝專案層級的相依套件：

```bash
pnpm install
```

## 2. 建置並封裝應用程式

要建置 macOS 應用程式並將其封裝為 `dist/OpenClaw.app`，請執行：

```bash
./scripts/package-mac-app.sh
```

如果你沒有 Apple Developer ID 憑證，該指令碼將自動使用 **ad-hoc 簽署**（`-`）。

關於開發執行模式、簽署旗標與 Team ID 疑難排解，請參閱 macOS 應用程式 README：
https://github.com/openclaw/openclaw/blob/main/apps/macos/README.md

> **注意**：以 ad-hoc 簽署的應用程式可能會觸發安全性提示。若應用程式在啟動後立即因「Abort trap 6」而當機，請參閱「[疑難排解](#troubleshooting)」章節。

## 3. 安裝 CLI

macOS 應用程式需要全域安裝的 `openclaw` CLI 來管理背景工作。

**安裝方式（建議）：**

1.  開啟 OpenClaw 應用程式。
2.  前往 **General** 設定分頁。
3.  點擊 **「Install CLI」**。

或者，手動安裝：

```bash
npm install -g openclaw@<version>
```

## 疑難排解

### 建置失敗：工具鏈或 SDK 不相容

macOS 應用程式的建置需要最新的 macOS SDK 與 Swift 6.2 工具鏈。

**系統相依項目（必須）：**

- **軟體更新中可取得的最新 macOS 版本**（Xcode 26.2 SDK 所需）
- **Xcode 26.2**（Swift 6.2 工具鏈）

**檢查：**

```bash
xcodebuild -version
xcrun swift --version
```

如果版本不相符，請更新 macOS／Xcode，然後重新執行建置。

### 授權權限時應用程式當機

若在允許 **語音辨識** 或 **麥克風** 存取時應用程式當機，可能是 TCC 快取損毀或簽章不相符所致。

**修復方式：**

1. 重設 TCC 權限：
   ```bash
   tccutil reset All bot.molt.mac.debug
   ```
2. 若仍無法解決，請在 [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) 中暫時變更 `BUNDLE_ID`，以強制 macOS 重新建立「乾淨狀態」。

### Gateway 閘道器 一直顯示「Starting...」

如果 Gateway 閘道器 狀態持續顯示「Starting...」，請檢查是否有殭屍行程占用連接埠：

```bash
openclaw gateway status
openclaw gateway stop

# If you’re not using a LaunchAgent (dev mode / manual runs), find the listener:
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

如果是手動執行的程序占用了連接埠，請停止該程序（Ctrl+C）。最後手段是終止上方找到的 PID。
