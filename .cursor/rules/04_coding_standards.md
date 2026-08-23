---
description: Compass Coding Standards — small commits, checks, tests, no speculation
alwaysApply: true
---

# Coding Standards

Compass Version2.1 以降の実装運用ルール。

## 必須

- **小さくコミットする** — 目的単位で分割。無関係な変更を混ぜない。
- **tsc・eslint を必ず通す** — 型エラー・Lint エラーを残したまま次へ進まない。
- **テストを書く** — ドメイン・Mapper・Hook 論理など、検証可能な単位にスクリプト／テストを付ける。
- **コメントは理由を書く** — What ではなく Why（制約・教育意図・Form2 との差分など）。
- **既存実装との整合性を崩さない** — Form2 / Notebook / Auth / RLS パターンと衝突させない。
- **リファクタリングは目的を明確にする** — ついでリファクタ禁止。目的・範囲・非対象を明示してから行う。
- **推測実装をしない** — 仕様が曖昧なら確認し、代替案を提示してから実装する。

## 変更前チェック

Constitution / Architecture / UI / Education に反していないか。反する場合は止めて報告する。
