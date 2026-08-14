# Compass Version2.1 様式3 詳細設計書

- 状態: **承認済み**（最小構成案を正式採用）
- 対象ベース: `release/lecture-2026`
- 実装ブランチ: `feature/version2-form3`
- Day 1: 型・静的定義・進捗/整理済み純関数・検証スクリプト（本ドキュメント保存）

---

## 1. 採用スコープ（Must）

- ゴードンの11の機能的健康パターン一覧
- 各パターンの定義・アセスメントの視点・情報収集項目（静的ガイド）
- 関連する患者情報 / 学生の解釈 / 他の情報・パターンとの関連（自由記述）
- 判断5区分 / 判断の根拠 / 追加で必要な情報
- 保存・編集・オートセーブ・再ログイン復元（Day 2 以降）
- 様式2および患者理解文の読み取り参照（転記なし）
- iPad Safari 対応

### 必達から除外（構造のみ将来拡張可）

- Evidence 選択引用 / カルテ・会話キャプチャ
- AI 問いかけ / 教員コメント / 関連図
- パターン間リンクの高度な UI / 提出管理

---

## 2. 教育設計

様式2から様式3への**転記機能は作らない**。

- 様式2: 全体像と仮説（問題・強みの可能性）
- 様式3: その視点を参照しながらゴードン11で再整理・解釈・根拠付け・修正

判断:

| 値 | 表示 |
|---|---|
| `functioning_normally` | 正常に機能している |
| `strength` | 強みがある |
| `problem` | 問題がある |
| `risk` | 問題が生じる可能性がある |
| `insufficient_information` | 情報不足で判断できない |

正常・強みを選んでも**判断根拠は必須**。

---

## 3. 保存と完了判定

- **オートセーブ**: 空欄許可。入力途中を常に保存できる。
- **整理済み（`isReviewed`)**: 次を満たすときのみ許可。
  - `judgment !== null`
  - `judgmentRationale.trim()` が空でない
  - `judgment === "insufficient_information"` のとき `additionalInformationNeeded.trim()` が空でない

保存と完了判定は分離する。サーバは `isReviewed: true` を受け取る際に同条件を再検証する（Day 2+）。

---

## 4. データモデル

テーブル候補: `form3_records`（マイグレーション `0016_form3_records.sql` — **未作成・Day 2**）

所有軸は `form2_records` と同一:

- `user_id`, `organization_id`, `academic_year`, `case_id`
- `payload` jsonb（`Form3Data`）
- `version`（楽観ロック）
- `created_at`, `updated_at`
- UNIQUE `(user_id, organization_id, academic_year, case_id)`

payload は `schemaVersion` を持つ。DB 列 `version` と混同しない。

11パターンは文字列配列ではなく固定キーの `Record`。

```ts
type Form3PatternData = {
  relatedInformation: string;
  interpretation: string;
  crossPatternRelations: string;
  judgment: Form3Judgment | null;
  judgmentRationale: string;
  additionalInformationNeeded: string;
  isReviewed: boolean;
};
```

様式2全文・Evidence ID・会話ログは payload に含めない（転記禁止の技術的担保）。

---

## 5. 画面方針（Day 3+）

- 中央主役は様式3。iPad で常時3カラムにしない。
- **1パターン切替方式を推奨**（11縦積みは非推奨）。
- 上部: タイトル・保存状態・進捗
- パターン一覧 + メイン入力 + ガイド折りたたみ
- 様式2 / 「私が捉えた患者さん」は参照シート（転記ボタンなし）

---

## 6. 進捗表示

| 状態 | 意味 |
|---|---|
| `not_started` | 未着手 |
| `in_progress` | 入力中 |
| `needs_rationale` | 判断済みだが完了条件未満（不正な isReviewed 含む） |
| `reviewed` | 整理済み（情報不足以外） |
| `reviewed_insufficient` | 情報不足として整理済み |

入力文字数では判定しない。`isReviewed === true` でも完了条件未達なら reviewed 扱いしない。

実装: `lib/form3/form3Progress.ts` / `lib/form3/form3Validation.ts`

---

## 7. 既存資産の再利用（実装時）

| 区分 | 対象 |
|---|---|
| 再利用 | `caseIdForPatient`, `callAction`, `classifyDbError`, Form2 楽観ロック手順, `Form2SheetView`, `patient_understanding_records` 読取 |
| 部分抽出 | `useForm2Supabase` 状態機械, `WorkspaceHost` / `LearningLayer` 差し替え点 |
| 新規 | `lib/form3/*`, Form3 Workspace UI, form3 actions/repository/hook, `0016` |
| 変更しない | Form2 編集本体, Evidence/links, 関連図, Admin, キャプチャフラグ |

---

## 8. Day 1 実装済みファイル

- `lib/form3/form3Types.ts`
- `lib/form3/form3PatternDefinitions.ts`
- `lib/form3/form3Progress.ts`
- `lib/form3/form3Validation.ts`
- `scripts/validate-form3-day1.ts`
- `docs/version2/18_form3_design.md`（本ファイル）

### ガイド原稿

基準資料: `Desktop/対象記録/1精神看護学　情報収集の視点.pdf`（精神看護援助論Ⅱ）。

- 11パターンすべての `labelJa` / `definition` / `assessmentPerspectives` / `informationChecklist` を転記済み（`lib/form3/form3PatternDefinitions.ts`）。
- PDF抽出文に誤変換候補（例: 「栄養雪舟方法」「治療の計合」「自己の味方」「情勢の生殖状態」「発達檀家」）があっても、**推測で置換していない**（資料文字列を保持し、コメントで注記）。
- Downloads の様式3アセスメント docx は記入用紙／事例記入例であり、ガイド本文の正本ではない。

---

## 9. Day 2 予定

- `0016_form3_records.sql` 作成（適用は承認後）
- `form3Repository` / `form3Mapper` / `saveForm3Action` / `loadForm3Action`
- sanitize・楽観ロック・conflict 返却

---

## 10. Definition of Done（講義対応版・全体）

学生が11パターンを開け、入力・判断・根拠・整理済みができ、再ログインで復元され、様式2/患者理解を参照でき（転記なし）、iPad で致命停止しないこと。Evidence引用・関連図・AI完成は含まない。
