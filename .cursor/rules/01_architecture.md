---
description: Compass Architecture Rules — persistence, RLS, actions, typesafety
alwaysApply: true
---

# Architecture Rules

Compass Version2.1 以降のアーキテクチャ原則。Constitution に次ぐ技術上の制約。

## 必須

- **Form2 と設計思想を統一する** — 所有軸・楽観ロック・RLS・Action → Repository → Mapper の流れを揃える。
- **RLS を前提に設計する** — 認可はクライアント制御に依存しない。行レベルの分離をサーバ側で強制する。
- **Server Actions 経由で保存する** — ブラウザから Repository / service role を直接呼ばない。
- **Repository パターンを維持する** — DB アクセスは Repository に閉じる。
- **Mapper で sanitize する** — クライアント申告の ID・未知キー・不正値を信用せず正規化する。
- **楽観ロックを採用する** — DB `version` で競合を検出し、conflict を明示的に扱う。
- **オートセーブを前提にする** — 保存のために思考を止めない（Constitution 原則8）。
- **型安全を最優先とする** — Result 型・共有型を崩さない。`any` や曖昧な境界を増やさない。
- **不要な依存ライブラリを追加しない** — 既存スタックで足りるなら足さない。
- **後方互換性を意識する** — 既存データ・既存 API・既存画面を壊す変更は目的を明示してから行う。

## 判断に迷ったら

全面改修より、既存 Form2 / Notebook パターンへの寄せを優先する。
