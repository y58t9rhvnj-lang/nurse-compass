# 03. Learning Journey 設計 — Compass Version2 β

> 本書は **設計のみ**。テーブルは今回作成しない（将来追加しやすい構造を定義する）。

## 設計思想

患者理解は **更新され続けるもの** です。

```
Ver1
 ↓  患者面接
Ver2
 ↓  カルテ確認
Ver3
 ↓  教員との振り返り
Ver4
 ↓  再び情報収集…
```

- これは**上書きではなく積み重ね**。「何によって理解が変わったか」を残すことに価値がある。
- 学習は直線ではない。情報収集 → 情報整理 → 患者理解 → **再び情報収集** と何度も行き来する。
  そのため「現在位置を1つだけ持つ」`student_stage_progress` は**採用しない**。
- 段階（stage）は状態ではなく**イベント**として Journey に残す。

## Journey の考え方

Journey は「学びの足跡」を時系列で残す append-only（追記専用）のログ。
段階遷移・気づき・バージョン作成・教員フィードバックなどを、**source（何によって）**とともに記録する。

### stage イベント例（行き来を許容）

- `entered_information_gathering`（情報収集に入った）
- `entered_information_organization`（情報整理に入った）
- `entered_patient_understanding`（患者理解に入った）
- `entered_form3`
- `entered_relational_diagram`
- `entered_nursing_plan`

同じ stage へ**何度でも**入れる（再訪を記録できる）。

### source（更新のきっかけ）

患者理解が「何によって」更新されたかを分析可能にするため `source` を持つ。

- `chart`（カルテ確認）
- `patient_interview`（患者面接）
- `thinking_guide`（Compass の思考ガイド）
- `teaching_guide`（Teaching Guide）
- `teacher_feedback`（教員との振り返り）
- `reflection`（自己の振り返り）
- `system`（システム由来）

## 将来テーブル（イメージ・今回は作成しない）

```sql
create table public.learning_journey (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  case_id         text not null,                 -- 教育ケース（例 SP-001）
  organization_id uuid not null references public.organizations(id),
  academic_year   integer not null default 2026,

  event_kind      text not null,                 -- 例: entered_patient_understanding /
                                                 --      revision_created / insight_added / reflection
  stage           text,                          -- 任意（情報収集 等の内部キー）
  source          text not null,                 -- chart / patient_interview / thinking_guide /
                                                 -- teaching_guide / teacher_feedback / reflection / system

  ref_type        text,                          -- 関連: understanding_revision / notebook_entry / form2 ...
  ref_id          uuid,                          -- 関連レコード
  note            text,
  occurred_at     timestamptz not null default now()
);
-- RLS: student=自分のみ(SELECT/INSERT, with check user_id=auth.uid()),
--      teacher/admin=SELECT のみ。
```

- `ref_type` / `ref_id` で `patient_understanding_revisions`・`notebook_entries`・`form2_records`
  と結び付け、Journey から「どの版・どの記録に起因するか」を辿れる。
- 段階の「現在位置」が必要な場面では、Journey の最新 `entered_*` から**導出**する
  （状態を別に持たない）。

## 形成評価との関係

- Journey は「学びの過程を可視化し、途中の助言に活かす」ためのもの。
- Thinking Guide の利用回数などを**評価点に反映しない**。順位付け・自動判定も行わない。

## 今後追加予定

- `learning_journey` テーブル本体（Phase 未定）
- Journey ビュー（学生の歩みのタイムライン表示）
- source 別・stage 別の集計（教育研究・形成的支援向け。個人の優劣判定には使わない）
