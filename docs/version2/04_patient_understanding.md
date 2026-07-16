# 04. Patient Understanding 設計 — Compass Version2 β

> 本書は **設計のみ**。テーブルは今回作成しない（将来追加しやすい構造を定義する）。

## 設計思想

「患者理解」は Compass の中心概念であり、**学びの成果物そのもの**ではなく
**形成されていく過程**として扱う。

- 患者理解は一度で完成しない。**版（Version）を重ねて更新**していく（上書きしない）。
- 更新のきっかけ（患者面接・カルテ・教員との振り返り 等）は Journey に source として残す（03）。
- 将来、**教育研究 / Compass Coach / Teaching Guide / 形成評価**で検索・分析できるよう、
  JSONB だけでなく**検索可能な主要カラム**を持たせる。

## データ構造（イメージ・今回は作成しない）

### patient_understandings（head: 最新の患者理解）

検索・分析用に主要カラムを持ち、詳細は payload(JSONB) に格納する。

| 列 | 型 | 備考 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid → auth.users(id) | 本人のみ |
| case_id | text | 教育ケース（例 SP-001） |
| organization_id | uuid → organizations(id) | |
| academic_year | integer | 既定 2026 |
| summary | text | 患者理解の要約（検索対象） |
| strength | text | 患者の強み（検索対象） |
| difficulty | text | 困難・課題（検索対象） |
| support_direction | text | 支援の方向性（検索対象） |
| payload | jsonb | 構造化された詳細 |
| version | integer | 現在の版番号 |
| created_at / updated_at | timestamptz | |
| | | unique(user_id, case_id, academic_year) |

### patient_understanding_revisions（版履歴・不変）

「上書きしない」を実現する追記専用の履歴。各保存が1版として残る。

| 列 | 型 | 備考 |
| --- | --- | --- |
| id | uuid PK | |
| understanding_id | uuid → patient_understandings(id) | |
| user_id | uuid | 本人 |
| case_id | text | |
| version | integer | |
| summary / strength / difficulty / support_direction | text | その版のスナップショット（検索可能） |
| payload | jsonb | その版の詳細 |
| change_source | text | 更新のきっかけ（Journey の source と対応） |
| created_by | text | student / teacher / system |
| created_at | timestamptz | |
| | | unique(understanding_id, version) |

## 更新の流れ（上書きではなく積み重ね）

```
[保存] → revisions に version=N を追記（不変）
       → head(patient_understandings) の主要カラム・payload・version を更新
       → learning_journey に revision_created (+ source) を記録
```

- head は「最新を速く読む」ため、revisions は「過程をたどる／巻き戻す」ため、
  Journey は「なぜ変わったかを束ねる」ため。役割を分ける。

## RLS 方針（将来）

- student: `user_id = auth.uid()` のみ SELECT / INSERT / UPDATE（WITH CHECK 必須）。
- teacher / admin: 全学生分を **SELECT のみ**。学生の患者理解を書き換えない。
- revisions は追記専用（UPDATE/DELETE ポリシーを付けない）。

## 検索・分析の用途（将来）

- **教育研究**: summary / difficulty 等での横断検索・傾向把握（個人の優劣判定には使わない）。
- **Compass Coach**: strength / support_direction を手がかりに助言を生成。
- **Teaching Guide**: 教員が学生の患者理解の推移を参照して助言。
- **形成評価**: 過程の把握に用いる。自動採点・順位付け・学生間比較は行わない。

## 今後追加予定

- `patient_understandings` / `patient_understanding_revisions` テーブル本体（Phase 未定）
- 版比較（diff）表示、Journey との連携ビュー
- 検索カラムのインデックス設計（全文検索を含む検討）
