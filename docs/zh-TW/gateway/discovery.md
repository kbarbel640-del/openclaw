---
summary: 「用於尋找 Gateway 的節點探索與傳輸（Bonjour、Tailscale、SSH）」
read_when:
  - 實作或變更 Bonjour 探索／廣播
  - 調整遠端連線模式（直接 vs SSH）
  - 設計遠端節點的探索 + 配對
title: 「探索與傳輸」
x-i18n:
  source_path: gateway/discovery.md
  source_hash: e12172c181515bfa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:29Z
---

# 探索與傳輸

OpenClaw 有兩個在表面上看起來相似、但本質不同的問題：

1. **操作員遠端控制**：macOS 選單列應用程式控制在其他位置執行的 Gateway 閘道器。
2. **節點配對**：iOS／Android（以及未來的節點）尋找 Gateway 閘道器並安全地完成配對。

設計目標是將所有網路探索／廣播集中在 **Node Gateway**（`openclaw gateway`），並讓用戶端（mac 應用程式、iOS）作為消費者。

## 名詞

- **Gateway 閘道器**：單一、長時間執行的 Gateway 程序，負責擁有狀態（工作階段、配對、節點登錄）並執行頻道。多數設定每台主機一個；也可進行隔離的多 Gateway 設定。
- **Gateway WS（控制平面）**：預設位於 `127.0.0.1:18789` 的 WebSocket 端點；可透過 `gateway.bind` 綁定至 LAN／tailnet。
- **直接 WS 傳輸**：面向 LAN／tailnet 的 Gateway WS 端點（不使用 SSH）。
- **SSH 傳輸（備援）**：透過 SSH 轉送 `127.0.0.1:18789` 來進行遠端控制。
- **舊版 TCP 橋接（已棄用／移除）**：較舊的節點傳輸方式（請見 [Bridge protocol](/gateway/bridge-protocol)）；已不再用於探索廣播。

通訊協定詳情：

- [Gateway protocol](/gateway/protocol)
- [Bridge protocol（舊版）](/gateway/bridge-protocol)

## 為何同時保留「直接」與 SSH

- **直接 WS** 在同一網路與 tailnet 內提供最佳使用體驗：
  - 透過 Bonjour 在 LAN 上自動探索
  - 由 Gateway 擁有配對權杖與 ACL
  - 不需要 shell 存取；通訊協定介面可保持精簡且可稽核
- **SSH** 仍是通用的備援方案：
  - 只要有 SSH 存取就能運作（即使跨越不相關的網路）
  - 能避開多播／mDNS 的問題
  - 除了 SSH 之外不需要新增任何入站連接埠

## 探索輸入（用戶端如何得知 Gateway 的位置）

### 1) Bonjour／mDNS（僅限 LAN）

Bonjour 以盡力而為為原則，且不跨網路。僅用於「同一 LAN」的便利性。

目標方向：

- **Gateway 閘道器** 透過 Bonjour 廣播其 WS 端點。
- 用戶端瀏覽並顯示「選擇一個 Gateway」清單，接著儲存所選端點。

疑難排解與信標細節：[Bonjour](/gateway/bonjour)。

#### 服務信標細節

- 服務類型：
  - `_openclaw-gw._tcp`（Gateway 傳輸信標）
- TXT 金鑰（非機密）：
  - `role=gateway`
  - `lanHost=<hostname>.local`
  - `sshPort=22`（或任何被廣播的值）
  - `gatewayPort=18789`（Gateway WS + HTTP）
  - `gatewayTls=1`（僅在啟用 TLS 時）
  - `gatewayTlsSha256=<sha256>`（僅在啟用 TLS 且指紋可用時）
  - `canvasPort=18793`（預設畫布主機連接埠；提供 `/__openclaw__/canvas/`）
  - `cliPath=<path>`（選用；可執行的 `openclaw` 進入點或二進位檔的絕對路徑）
  - `tailnetDns=<magicdns>`（選用提示；當可使用 Tailscale 時會自動偵測）

停用／覆寫：

- `OPENCLAW_DISABLE_BONJOUR=1` 會停用廣播。
- `gateway.bind` 於 `~/.openclaw/openclaw.json` 中控制 Gateway 綁定模式。
- `OPENCLAW_SSH_PORT` 覆寫在 TXT 中廣播的 SSH 連接埠（預設為 22）。
- `OPENCLAW_TAILNET_DNS` 發布 `tailnetDns` 提示（MagicDNS）。
- `OPENCLAW_CLI_PATH` 覆寫所廣播的 CLI 路徑。

### 2) Tailnet（跨網路）

對於倫敦／維也納這類的設定，Bonjour 不會有幫助。建議的「直接」目標為：

- Tailscale MagicDNS 名稱（優先）或穩定的 tailnet IP。

若 Gateway 能偵測到自己在 Tailscale 下執行，會發布 `tailnetDns` 作為用戶端的選用提示（包含廣域信標）。

### 3) 手動／SSH 目標

當沒有直接路徑（或已停用直接連線）時，用戶端仍可透過轉送 local loopback 的 Gateway 連接埠，以 SSH 進行連線。

請見 [Remote access](/gateway/remote)。

## 傳輸選擇（用戶端策略）

建議的用戶端行為：

1. 若已設定且可連線的已配對直接端點存在，使用它。
2. 否則，若 Bonjour 在 LAN 上找到 Gateway，提供一鍵「使用此 Gateway」的選項，並將其儲存為直接端點。
3. 否則，若已設定 tailnet DNS／IP，嘗試直接連線。
4. 否則，退回使用 SSH。

## 配對 + 驗證（直接傳輸）

Gateway 是節點／用戶端准入的唯一事實來源。

- 配對請求會在 Gateway 中建立／核准／拒絕（請見 [Gateway pairing](/gateway/pairing)）。
- Gateway 會強制：
  - 驗證（權杖／金鑰對）
  - 範圍／ACL（Gateway 並非對所有方法的原始代理）
  - 速率限制

## 依元件劃分的職責

- **Gateway 閘道器**：廣播探索信標、擁有配對決策，並託管 WS 端點。
- **macOS 應用程式**：協助選擇 Gateway、顯示配對提示，且僅在備援時使用 SSH。
- **iOS／Android 節點**：將 Bonjour 作為便利方式進行瀏覽，並連線至已配對的 Gateway WS。
