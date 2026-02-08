---
summary: 「Windows（WSL2）のサポートとコンパニオンアプリの状況」
read_when:
  - 「Windows に OpenClaw をインストールする場合」
  - 「Windows コンパニオンアプリの状況を確認したい場合」
title: 「Windows（WSL2）」
x-i18n:
  source_path: platforms/windows.md
  source_hash: c93d2263b4e5b60c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:31Z
---

# Windows（WSL2）

Windows 上の OpenClaw は、**WSL2 経由**（Ubuntu 推奨）での利用を推奨します。
CLI + Gateway（ゲートウェイ）は Linux 内で実行されるため、実行環境の一貫性が保たれ、
ツールチェーン（Node/Bun/pnpm、Linux バイナリ、Skills）との互換性が大幅に向上します。
ネイティブ Windows はやや扱いが難しい場合があります。WSL2 を使えば、完全な Linux 体験を
得られ、インストールは 1 コマンドで完了します: `wsl --install`。

ネイティブ Windows のコンパニオンアプリは、将来的に提供予定です。

## インストール（WSL2）

- [はじめに](/start/getting-started)（WSL 内で使用）
- [インストールと更新](/install/updating)
- 公式 WSL2 ガイド（Microsoft）: https://learn.microsoft.com/windows/wsl/install

## Gateway（ゲートウェイ）

- [Gateway（ゲートウェイ）運用ガイド](/gateway)
- [設定](/gateway/configuration)

## Gateway（ゲートウェイ）サービスのインストール（CLI）

WSL2 内で実行します:

```
openclaw onboard --install-daemon
```

または:

```
openclaw gateway install
```

または:

```
openclaw configure
```

プロンプトが表示されたら **Gateway service** を選択してください。

修復 / 移行:

```
openclaw doctor
```

## 上級: WSL サービスを LAN に公開する（portproxy）

WSL には独自の仮想ネットワークがあります。別のマシンから **WSL 内で実行中の**
サービス（SSH、ローカル TTS サーバー、または Gateway）にアクセスする必要がある場合、
Windows のポートを現在の WSL IP に転送する必要があります。WSL の IP は再起動後に
変わるため、転送ルールの更新が必要になることがあります。

例（PowerShell **管理者として実行**）:

```powershell
$Distro = "Ubuntu-24.04"
$ListenPort = 2222
$TargetPort = 22

$WslIp = (wsl -d $Distro -- hostname -I).Trim().Split(" ")[0]
if (-not $WslIp) { throw "WSL IP not found." }

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort `
  connectaddress=$WslIp connectport=$TargetPort
```

Windows ファイアウォールでポートを許可（初回のみ）:

```powershell
New-NetFirewallRule -DisplayName "WSL SSH $ListenPort" -Direction Inbound `
  -Protocol TCP -LocalPort $ListenPort -Action Allow
```

WSL 再起動後に portproxy を更新:

```powershell
netsh interface portproxy delete v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 `
  connectaddress=$WslIp connectport=$TargetPort | Out-Null
```

注意事項:

- 別マシンからの SSH は **Windows ホスト IP** を指定します（例: `ssh user@windows-host -p 2222`）。
- リモートノードは **到達可能な** Gateway URL を指定する必要があります（`127.0.0.1` ではありません）。確認には
  `openclaw status --all` を使用してください。
- LAN アクセスには `listenaddress=0.0.0.0` を使用します。`127.0.0.1` はローカル専用です。
- 自動化したい場合は、ログイン時に更新ステップを実行するスケジュールタスクを登録してください。

## WSL2 インストール手順（ステップバイステップ）

### 1) WSL2 + Ubuntu のインストール

PowerShell（管理者）を開きます:

```powershell
wsl --install
# Or pick a distro explicitly:
wsl --list --online
wsl --install -d Ubuntu-24.04
```

Windows から再起動を求められた場合は再起動してください。

### 2) systemd を有効化（Gateway インストールに必須）

WSL ターミナル内で実行します:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

次に PowerShell から実行します:

```powershell
wsl --shutdown
```

Ubuntu を再度開き、次を確認します:

```bash
systemctl --user status
```

### 3) OpenClaw のインストール（WSL 内）

WSL 内で Linux の「はじめに」フローに従ってください:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard
```

完全なガイド: [はじめに](/start/getting-started)

## Windows コンパニオンアプリ

現在、Windows 向けのコンパニオンアプリは提供されていません。
実現に向けた貢献をしていただける場合、コントリビューションを歓迎します。
