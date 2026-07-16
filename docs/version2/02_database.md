# 02. データベース設計 — Compass Version2 β

## 設計思想

- **データ分離が最優先**: すべての学生データは `user_id`（= `auth.users.id`）に紐づけ、
  RLS で「本人のみ読み書き可能」を強制する。クライアント制御に依存しない。
- **患者ではなく教育ケース**: Compass が扱うのは患者ではなく**教育ケース**。
  識別子は `patient_id` ではなく **`case_id`**（例: `SP-001`, `SP-002`）を用いる。
- **上書きしない**: 患者理解は履歴・バージョンで積み重ねる（04 / 03 参照）。
- **将来の拡張に耐える**: 組織（学校）は UUID 参照、年度は `academic_year` を各データに持たせる。

## 今回作成するテーブル（Phase 2）

### organizations（複数学校対応の布石）

| 列 | 型 | 備考 |
| --- | --- | --- |
| id | uuid PK | |
| slug | text unique | 内部識別子（今回 `default`） |
| name | text | 表示名（`Compass Default Organization`） |
| is_active | boolean | |
| created_at / updated_at | timestamptz | |

- 今回は `default` の1件のみ。`organization_id` は **TEXT ではなく organizations への UUID 参照**。

### profiles

| 列 | 型 | 備考 |
| --- | --- | --- |
| id | uuid PK → auth.users(id) | 1ユーザー=1プロフィール |
| login_id | text unique | 正規化済み（英数字・ハイフン・小文字） |
| display_name | text | |
| student_number | text null | 学生のみ想定 |
| class_name | text null | |
| role | text check(student/teacher/admin) | |
| organization_id | uuid → organizations(id) | 今回は default |
| academic_year | integer | 今回 2026 固定 |
| is_active | boolean | 無効化ユーザーはログイン不可 |
| created_at / updated_at | timestamptz | updated_at は自動更新トリガー |

- **learning_stage は持たせない**（現在位置1つの設計を採用しない。段階は Journey へ。03 参照）。

## ER イメージ（今回 + 将来）

```
                         ┌───────────────┐
                         │ organizations │
                         └──────┬────────┘
                                │ 1
                                │
                                │ N
                         ┌──────▼────────┐
      auth.users 1───1   │   profiles    │
                         │ (role,org,year)│
                         └──────┬────────┘
                                │ user_id (= auth.uid())
        ┌───────────────┬───────┼───────────────┬────────────────────┐
        │               │       │               │                    │
   (将来)          (将来)   (将来)          (将来)               (将来)
┌───────────────┐ ┌──────────────┐ ┌───────────────────────┐ ┌──────────────────┐
│ notebook_     │ │ form2_       │ │ patient_understandings │ │ learning_journey │
│ entries       │ │ records      │ │  + _revisions          │ │ (source付き)     │
│ (case_id,ver) │ │ (case_id,ver)│ │ (case_id, 検索カラム)  │ │ (case_id,source) │
└───────────────┘ └──────────────┘ └───────────────────────┘ └──────────────────┘
        すべて user_id / organization_id / academic_year / case_id を保持
```

## RLS 方針

判定は SECURITY DEFINER 関数 `current_app_role()` / `is_staff()` / `current_organization_id()`
で行う（profiles を参照するポリシー内の無限再帰を避けるため）。これらは常に `auth.uid()` を
基準にし、任意の user_id を渡せない。実行権限は PUBLIC / anon から revoke し、authenticated
のみに grant する（未認証は関数を実行できない）。

- **組織スコープ**: teacher / admin の閲覧は「自分と同じ `organization_id`」に限定する
  （organization_id 採用の目的＝学校間データ分離）。β版では admin も teacher と同じく
  同一組織内のみ。全組織横断は持たせない（将来 system_admin を別権限で追加）。
- **student**: 自分の行のみ（`user_id = auth.uid()`）。SELECT / INSERT / UPDATE 可、DELETE 不可（原則）。
- **teacher / admin**: 同一組織の学生データを **SELECT のみ**。学生データへの書込不可。教員注釈のみ作成・更新可。
- **profiles（今回）**: student=自分のみ SELECT、teacher/admin=同一組織の profiles のみ SELECT。
  一般ユーザーの INSERT/UPDATE ポリシーは作らない（作成・更新はシード=service role のみ）。
- **organizations（今回）**: 認証済みユーザーは自分が所属する組織のみ SELECT
  （`id = current_organization_id()`）。作成・更新はシードのみ。

### なりすまし防止（将来の学生データ系テーブル共通ルール）

学生が書き込むテーブルでは、SELECT だけでなく **INSERT / UPDATE の WITH CHECK にも
必ず `user_id = auth.uid()` を課す**。

```sql
-- 例（将来 notebook_entries 等に適用）
create policy xxx_insert_self on public.<table>
  for insert to authenticated
  with check (user_id = auth.uid());

create policy xxx_update_self on public.<table>
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- service role は RLS を回避できるため、通常の学生・教員データ取得には使わない（シード限定）。

## 適用手順（管理者・手動）

1. Supabase SQL Editor で以下を順に実行:
   - `supabase/migrations/0001_organizations.sql`
   - `supabase/migrations/0002_profiles.sql`
   - `supabase/migrations/0003_functions_and_rls.sql`
2. Auth 設定でメール確認を OFF（仮想メールを検証不要にする）。
3. アカウント投入（学生本人の新規登録は不可）:
   ```
   npx tsx --env-file=.env.local scripts/v2/seed-users.ts scripts/v2/seed-users.local.json
   ```
   入力例は `scripts/v2/seed-users.example.json`（架空データ）。実データ・パスワードはコミットしない。

## 今後追加予定

- `notebook_entries` / `form2_records`（Phase 3、payload + version + case_id）
- `learning_events`（Phase 4、最小の学習ログ）
- `teaching_annotations`（Phase 5、教員の Apple Pencil 書き込み）
- `patient_understandings` / `patient_understanding_revisions` / `learning_journey`（設計のみ。04 / 03）
