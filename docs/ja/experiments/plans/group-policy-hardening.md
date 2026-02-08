---
summary: "Telegram 許可リストの強化: プレフィックス + 空白の正規化"
read_when:
  - 過去の Telegram 許可リスト変更を確認する場合
title: "Telegram 許可リストの強化"
x-i18n:
  source_path: experiments/plans/group-policy-hardening.md
  source_hash: a2eca5fcc8537694
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:19:18Z
---

# Telegram 許可リストの強化

**日付**: 2026-01-05  
**ステータス**: 完了  
**PR**: #216

## 概要

Telegram の許可リストは現在、`telegram:` および `tg:` のプレフィックスを大文字・小文字を区別せずに受け付け、誤って混入した空白も許容します。これにより、受信側の許可リストチェックが、送信時の正規化と整合するようになります。

## 変更点

- プレフィックス `telegram:` と `tg:` は同一として扱われます（大文字・小文字は区別しません）。
- 許可リストのエントリはトリムされ、空のエントリは無視されます。

## 例

これらはすべて、同じ ID として受け付けられます:

- `telegram:123456`
- `TG:123456`
- `tg:123456`

## 重要な理由

ログやチャット ID からのコピー/ペーストには、プレフィックスや空白が含まれることがよくあります。正規化により、ダイレクトメッセージやグループで応答するかどうかを判断する際の誤検知（false negatives）を回避できます。

## 関連ドキュメント

- [グループチャット](/concepts/groups)
- [Telegram プロバイダー](/channels/telegram)
