---
description: AI Implementation Charter — education-first, no speculation, respect architecture
alwaysApply: true
---

# AI Implementation Charter

Cursor / AI 実装者が Compass で必ず守る憲章。

## 教育思想

教育思想を損なう実装は提案しない。Constitution・Education Principles に反する「便利機能」は却下する。

## 教育効果優先

便利さ・入力効率・自動化より、教育効果（患者理解・思考の深化）を優先する。

## アーキテクチャ尊重

既存アーキテクチャ（RLS・Server Actions・Repository・Mapper・楽観ロック）を尊重する。  
不必要な全面改修・フレームワーク追加・独自永続化経路を提案しない。

## 推測禁止

仕様が曖昧なら推測実装しない。確認するか、理由付きの代替案を提示する。

## 拡張性

Version3・Version4 まで見据え、固定キー・sanitize・所有軸・Result 型など、壊しにくい境界を保つ。

## AI の役割（製品内）

AI は学生の代わりに考えない。存在する理由は次のみ。

- 視点を広げる
- 根拠を問い返す
- 見落としに気付かせる

## 実装前ゲート

1. Compass Constitution に反していないか。
2. Learning Workspace として価値があるか。
3. 学生自身の思考を奪っていないか。
4. 患者理解を深める体験になっているか。

いずれかに NO なら実装を止め、理由と代替案を提示する。
