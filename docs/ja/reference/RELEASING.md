---
summary: "npm + macOS アプリ向けのステップバイステップ リリースチェックリスト"
read_when:
  - 新しい npm リリースを作成するとき
  - 新しい macOS アプリリリースを作成するとき
  - 公開前にメタデータを検証するとき
x-i18n:
  source_path: reference/RELEASING.md
  source_hash: 54cb2b822bfa3c0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:59Z
---

# リリースチェックリスト（npm + macOS）

リポジトリのルートで `pnpm`（Node 22+）を使用します。タグ付けや公開の前に、作業ツリーがクリーンであることを保ってください。

## オペレーター トリガー

オペレーターが「release」と言ったら、直ちに次の事前確認を実行します（ブロックされない限り、追加の質問はしません）。

- このドキュメントと `docs/platforms/mac/release.md` を読みます。
- `~/.profile` から env を読み込み、`SPARKLE_PRIVATE_KEY_FILE` と App Store Connect の環境変数が設定されていることを確認します（SPARKLE_PRIVATE_KEY_FILE は `~/.profile` に配置する必要があります）。
- 必要に応じて `~/Library/CloudStorage/Dropbox/Backup/Sparkle` の Sparkle キーを使用します。

1. **バージョン & メタデータ**

- [ ] `package.json` のバージョンを更新します（例：`2026.1.29`）。
- [ ] `pnpm plugins:sync` を実行して、拡張パッケージのバージョンと changelog を整合させます。
- [ ] CLI / バージョン文字列を更新します：[`src/cli/program.ts`](https://github.com/openclaw/openclaw/blob/main/src/cli/program.ts) と、[`src/provider-web.ts`](https://github.com/openclaw/openclaw/blob/main/src/provider-web.ts) の Baileys ユーザーエージェント。
- [ ] パッケージメタデータ（name、description、repository、keywords、license）を確認し、`bin` マップが `openclaw` 向けに [`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs) を指していることを確認します。
- [ ] 依存関係が変更された場合は、`pnpm install` を実行して `pnpm-lock.yaml` が最新であることを確認します。

2. **ビルド & 成果物**

- [ ] A2UI の入力が変更された場合は、`pnpm canvas:a2ui:bundle` を実行し、更新された [`src/canvas-host/a2ui/a2ui.bundle.js`](https://github.com/openclaw/openclaw/blob/main/src/canvas-host/a2ui/a2ui.bundle.js) をコミットします。
- [ ] `pnpm run build`（`dist/` を再生成します）。
- [ ] npm パッケージ `files` に、必要な `dist/*` フォルダーがすべて含まれていることを確認します（特に、ヘッドレス node + ACP CLI 向けの `dist/node-host/**` と `dist/acp/**`）。
- [ ] `dist/build-info.json` が存在し、期待される `commit` ハッシュが含まれていることを確認します（CLI バナーは npm インストール時にこれを使用します）。
- [ ] 任意：ビルド後に `npm pack --pack-destination /tmp` を実行し、tarball の内容を確認して GitHub リリース用に手元に保管します（**コミットしない**でください）。

3. **Changelog & ドキュメント**

- [ ] `CHANGELOG.md` をユーザー向けのハイライトで更新します（存在しない場合は作成します）。エントリーは必ずバージョン降順に保ちます。
- [ ] README の例やフラグが現在の CLI の挙動と一致していることを確認します（特に新しいコマンドやオプション）。

4. **検証**

- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm test`（カバレッジ出力が必要な場合は `pnpm test:coverage`）
- [ ] `pnpm release:check`（npm pack の内容を検証します）
- [ ] `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke`（Docker インストールのスモークテスト、迅速パス。リリース前に必須）
  - 直前の npm リリースが既知の不具合を含む場合は、事前インストール手順で `OPENCLAW_INSTALL_SMOKE_PREVIOUS=<last-good-version>` または `OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS=1` を設定します。
- [ ] （任意）フル インストーラー スモーク（非 root + CLI のカバレッジを追加）：`pnpm test:install:smoke`
- [ ] （任意）インストーラー E2E（Docker、`curl -fsSL https://openclaw.ai/install.sh | bash` を実行し、オンボーディング後に実際のツール呼び出しを実行）
  - `pnpm test:install:e2e:openai`（`OPENAI_API_KEY` が必要）
  - `pnpm test:install:e2e:anthropic`（`ANTHROPIC_API_KEY` が必要）
  - `pnpm test:install:e2e`（両方のキーが必要。両プロバイダーを実行）
- [ ] （任意）変更が送受信パスに影響する場合は、Web Gateway（ゲートウェイ）をスポットチェックします。

5. **macOS アプリ（Sparkle）**

- [ ] macOS アプリをビルドして署名し、配布用に zip 化します。
- [ ] Sparkle の appcast を生成します（HTML のノートは [`scripts/make_appcast.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/make_appcast.sh) 経由）し、`appcast.xml` を更新します。
- [ ] アプリの zip（および任意の dSYM zip）を GitHub リリースに添付できるよう準備します。
- [ ] 正確なコマンドと必要な環境変数については [macOS release](/platforms/mac/release) に従います。
  - `APP_BUILD` は数値かつ単調増加である必要があります（`-beta` は不可）。Sparkle が正しくバージョン比較できるようにするためです。
  - 公証する場合は、App Store Connect API の環境変数から作成した `openclaw-notary` キーチェーン プロファイルを使用します（[macOS release](/platforms/mac/release) を参照）。

6. **公開（npm）**

- [ ] git のステータスがクリーンであることを確認し、必要に応じてコミットして push します。
- [ ] 必要に応じて `npm login`（2FA の確認）を実行します。
- [ ] `npm publish --access public`（プレリリースには `--tag beta` を使用）。
- [ ] レジストリを確認します：`npm view openclaw version`、`npm view openclaw dist-tags`、および `npx -y openclaw@X.Y.Z --version`（または `--help`）。

### トラブルシューティング（2.0.0-beta2 リリース時のメモ）

- **npm pack / publish がハングする、または巨大な tarball を生成する**：`dist/OpenClaw.app` 内の macOS アプリバンドル（およびリリース zip）がパッケージに取り込まれます。`package.json` `files` により公開内容をホワイトリスト化して修正します（dist のサブディレクトリ、docs、skills を含め、アプリバンドルを除外）。`npm pack --dry-run` で `dist/OpenClaw.app` が一覧に含まれていないことを確認します。
- **dist-tags 用の npm auth web ループ**：OTP プロンプトを表示するためにレガシー認証を使用します。
  - `NPM_CONFIG_AUTH_TYPE=legacy npm dist-tag add openclaw@X.Y.Z latest`
- **`npx` の検証が `ECOMPROMISED: Lock compromised` で失敗する**：新しいキャッシュで再試行します。
  - `NPM_CONFIG_CACHE=/tmp/npm-cache-$(date +%s) npx -y openclaw@X.Y.Z --version`
- **遅延修正後にタグの付け替えが必要**：タグを強制更新して push し、その後 GitHub リリースのアセットが引き続き一致していることを確認します。
  - `git tag -f vX.Y.Z && git push -f origin vX.Y.Z`

7. **GitHub リリース + appcast**

- [ ] タグ付けして push：`git tag vX.Y.Z && git push origin vX.Y.Z`（または `git push --tags`）。
- [ ] `vX.Y.Z` の GitHub リリースを作成または更新し、**タイトルは `openclaw X.Y.Z`**（タグ名だけにしない）とします。本文には、そのバージョンの **完全な** changelog セクション（Highlights + Changes + Fixes）をインラインで含め（素のリンクは不可）、**本文内でタイトルを繰り返さない**でください。
- [ ] 成果物を添付します：`npm pack` の tarball（任意）、`OpenClaw-X.Y.Z.zip`、および `OpenClaw-X.Y.Z.dSYM.zip`（生成されている場合）。
- [ ] 更新された `appcast.xml` をコミットして push します（Sparkle は main から配信されます）。
- [ ] クリーンな一時ディレクトリ（`package.json` なし）から、`npx -y openclaw@X.Y.Z send --help` を実行して、インストール / CLI のエントリーポイントが動作することを確認します。
- [ ] リリースノートを告知 / 共有します。

## プラグイン公開スコープ（npm）

`@openclaw/*` スコープ配下の **既存の npm プラグイン** のみを公開します。npm に存在しない同梱プラグインは **ディスクツリーのみ** に留めます（`extensions/**` には引き続き同梱されます）。

一覧を導出する手順：

1. `npm search @openclaw --json` を実行し、パッケージ名を取得します。
2. `extensions/*/package.json` の名前と比較します。
3. **共通部分**（すでに npm に存在するもの）のみを公開します。

現在の npm プラグイン一覧（必要に応じて更新）：

- @openclaw/bluebubbles
- @openclaw/diagnostics-otel
- @openclaw/discord
- @openclaw/feishu
- @openclaw/lobster
- @openclaw/matrix
- @openclaw/msteams
- @openclaw/nextcloud-talk
- @openclaw/nostr
- @openclaw/voice-call
- @openclaw/zalo
- @openclaw/zalouser

リリースノートでは、**デフォルトでは有効化されていない** **新しい任意の同梱プラグイン**（例：`tlon`）についても必ず言及してください。
