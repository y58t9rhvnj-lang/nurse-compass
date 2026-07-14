# ADR-001

## Title

iPad Safari タップイベントが動作しなかった問題への対応

## Status

Accepted

## Date

2026-07-10

## Context

iPad Safariで画面は表示されるが、
全てのボタン・患者・サイドバーがタップできなかった。

PCブラウザでは正常動作していた。

## Cause

Next.js 16 の開発サーバーで
allowedDevOrigins が設定されていなかったため、
LAN経由アクセス時にReactイベントが正常に動作しなかった。

## Decision

next.config.ts に

allowedDevOrigins

を設定する。

開発サーバーは

rm -rf .next

後に再起動する。

## Consequences

iPad Safariでも正常にReactイベントが動作する。

今後LAN経由で動作確認を行う場合も
同じ設定を利用する。
