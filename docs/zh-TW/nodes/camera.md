---
summary: "供代理程式使用的相機擷取（iOS 節點 + macOS 應用程式）：照片（jpg）與短影片片段（mp4）"
read_when:
  - 新增或修改 iOS 節點或 macOS 上的相機擷取
  - 擴充代理程式可存取的 MEDIA 暫存檔工作流程
title: "相機擷取"
x-i18n:
  source_path: nodes/camera.md
  source_hash: b4d5f5ecbab6f705
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:56Z
---

# 相機擷取（代理程式）

OpenClaw 支援用於代理程式工作流程的 **相機擷取**：

- **iOS 節點**（透過 Gateway 閘道器 配對）：擷取 **照片**（`jpg`）或 **短影片片段**（`mp4`，可選擇是否包含音訊），透過 `node.invoke`。
- **Android 節點**（透過 Gateway 閘道器 配對）：擷取 **照片**（`jpg`）或 **短影片片段**（`mp4`，可選擇是否包含音訊），透過 `node.invoke`。
- **macOS 應用程式**（作為 Gateway 閘道器 的節點）：擷取 **照片**（`jpg`）或 **短影片片段**（`mp4`，可選擇是否包含音訊），透過 `node.invoke`。

所有相機存取皆受 **使用者可控制的設定** 所管控。

## iOS 節點

### 使用者設定（預設為開啟）

- iOS 設定頁籤 → **相機** → **允許相機**（`camera.enabled`）
  - 預設：**開啟**（缺少金鑰會視為已啟用）。
  - 關閉時：`camera.*` 指令會回傳 `CAMERA_DISABLED`。

### 指令（透過 Gateway 閘道器 `node.invoke`）

- `camera.list`
  - 回應負載：
    - `devices`：`{ id, name, position, deviceType }` 的陣列

- `camera.snap`
  - 參數：
    - `facing`：`front|back`（預設：`front`）
    - `maxWidth`：number（選用；iOS 節點上的預設為 `1600`）
    - `quality`：`0..1`（選用；預設：`0.9`）
    - `format`：目前為 `jpg`
    - `delayMs`：number（選用；預設：`0`）
    - `deviceId`：string（選用；來自 `camera.list`）
  - 回應負載：
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`、`height`
  - 負載防護：照片會重新壓縮，以將 base64 負載維持在 5 MB 以下。

- `camera.clip`
  - 參數：
    - `facing`：`front|back`（預設：`front`）
    - `durationMs`：number（預設：`3000`，上限會被限制為 `60000`）
    - `includeAudio`：boolean（預設：`true`）
    - `format`：目前為 `mp4`
    - `deviceId`：string（選用；來自 `camera.list`）
  - 回應負載：
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

### 前景需求

如同 `canvas.*`，iOS 節點僅允許在 **前景** 執行 `camera.*` 指令。背景呼叫會回傳 `NODE_BACKGROUND_UNAVAILABLE`。

### CLI 輔助工具（暫存檔 + MEDIA）

取得附件最簡單的方式是使用 CLI 輔助工具；它會將解碼後的媒體寫入暫存檔，並輸出 `MEDIA:<path>`。

範例：

```bash
openclaw nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
openclaw nodes camera snap --node <id> --facing front
openclaw nodes camera clip --node <id> --duration 3000
openclaw nodes camera clip --node <id> --no-audio
```

備註：

- `nodes camera snap` 預設為 **兩個** 鏡頭方向，以便代理程式同時取得兩種視角。
- 輸出檔案為暫存檔（位於作業系統的暫存目錄），除非你自行建立包裝器。

## Android 節點

### 使用者設定（預設為開啟）

- Android 設定頁面 → **相機** → **允許相機**（`camera.enabled`）
  - 預設：**開啟**（缺少金鑰會視為已啟用）。
  - 關閉時：`camera.*` 指令會回傳 `CAMERA_DISABLED`。

### 權限

- Android 需要執行期權限：
  - `CAMERA`，用於 `camera.snap` 與 `camera.clip`。
  - `RECORD_AUDIO`，用於 `camera.clip`，當 `includeAudio=true` 時。

若缺少權限，應用程式會在可能時提示；若被拒絕，`camera.*` 請求會以
`*_PERMISSION_REQUIRED` 錯誤失敗。

### 前景需求

如同 `canvas.*`，Android 節點僅允許在 **前景** 執行 `camera.*` 指令。背景呼叫會回傳 `NODE_BACKGROUND_UNAVAILABLE`。

### 負載防護

照片會重新壓縮，以將 base64 負載維持在 5 MB 以下。

## macOS 應用程式

### 使用者設定（預設為關閉）

macOS 配套應用程式提供一個核取方塊：

- **設定 → 一般 → 允許相機**（`openclaw.cameraEnabled`）
  - 預設：**關閉**
  - 關閉時：相機請求會回傳「Camera disabled by user」。

### CLI 輔助工具（節點呼叫）

使用主要的 `openclaw` CLI，在 macOS 節點上呼叫相機指令。

範例：

```bash
openclaw nodes camera list --node <id>            # list camera ids
openclaw nodes camera snap --node <id>            # prints MEDIA:<path>
openclaw nodes camera snap --node <id> --max-width 1280
openclaw nodes camera snap --node <id> --delay-ms 2000
openclaw nodes camera snap --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --duration 10s          # prints MEDIA:<path>
openclaw nodes camera clip --node <id> --duration-ms 3000      # prints MEDIA:<path> (legacy flag)
openclaw nodes camera clip --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --no-audio
```

備註：

- `openclaw nodes camera snap` 預設為 `maxWidth=1600`，除非另行覆寫。
- 在 macOS 上，`camera.snap` 會在預熱／曝光穩定後等待 `delayMs`（預設 2000ms）再進行擷取。
- 照片負載會重新壓縮，以將 base64 維持在 5 MB 以下。

## 安全性 + 實務限制

- 相機與麥克風存取會觸發作業系統的一般權限提示（並且需要在 Info.plist 中提供使用說明字串）。
- 影片片段有上限（目前為 `<= 60s`），以避免節點負載過大（base64 額外負擔 + 訊息限制）。

## macOS 螢幕影片（作業系統層級）

針對「螢幕」影片（非相機），請使用 macOS 配套應用程式：

```bash
openclaw nodes screen record --node <id> --duration 10s --fps 15   # prints MEDIA:<path>
```

備註：

- 需要 macOS **螢幕錄製** 權限（TCC）。
