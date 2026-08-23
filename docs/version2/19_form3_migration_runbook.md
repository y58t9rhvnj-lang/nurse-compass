# Form3 `0016_form3_records` 適用前チェック・実DB検証ランブック

- 状態: **適用前レビュー用**（本ドキュメント作成時点で **未適用**）
- 対象: `supabase/migrations/0016_form3_records.sql`
- ブランチ: `feature/version2-form3`
- Day 2 コミット: `8295ac1`
- 方針: **Production へは適用しない**。人間が Preview / 開発用プロジェクトで SQL Editor 適用する前提。

---

## 1. 依存オブジェクト一覧

| オブジェクト | 種別 | 定義元 | 0016適用前に必要か | 0001〜0015通し適用で満たされるか |
| --- | --- | --- | --- | --- |
| `public.organizations` | table | `0001_organizations.sql` | 必須（FK） | はい |
| `auth.users` | table | Supabase Auth（プラットフォーム） | 必須（FK） | はい（Supabase前提） |
| `public.profiles` | table | `0002_profiles.sql` | 必須（RLS関数が参照） | はい |
| `pgcrypto` / `gen_random_uuid()` | extension / fn | `0001`（`create extension if not exists pgcrypto`）。`0015`でも再確認 | 必須（PK default） | はい |
| `public.set_updated_at()` | function | `0003_functions_and_rls.sql` | 必須（updated_at トリガー） | はい |
| `public.reject_immutable_columns()` | function | `0005` 初出 → `0008` で是正版 | 必須（不変トリガー） | はい（0008後の定義を想定） |
| `public.current_app_role()` | function | `0003` | 必須（学生判定） | はい |
| `public.is_staff()` | function | `0003` | 必須（職員判定） | はい |
| `public.current_organization_id()` | function | `0003` | 必須（組織判定） | はい |
| `public.current_academic_year()` | function | `0005_form2_records.sql` | 必須（年度判定） | はい |
| `authenticated` | role | Supabase 既定 | 必須（POLICY / GRANT） | はい |
| `service_role` | role | Supabase 既定 | 必須（GRANT ALL） | はい |
| `anon` | role | Supabase 既定 | 0016は **GRANTしない**（依存なし） | — |

### 実行順依存（重要）

- `0016` は **新規関数を定義しない**。上記はすべて既存 migration 依存。
- **`0016` 単独適用は不可**。少なくとも `0001`〜`0005`（および `0008` の `reject_immutable_columns` 是正）が先に入っていること。
- 通常の講義用 DB（`0001`〜`0015` 適用済み）であれば満たされる。
- Auth の `auth.users` が無い環境（素の Postgres）では FK が失敗する。

### 適用前存在確認用 SQL（実行は任意・読み取りのみ）

```sql
-- 依存オブジェクトの存在確認（適用前）
select to_regclass('public.organizations') as organizations,
       to_regclass('public.profiles') as profiles,
       to_regprocedure('public.set_updated_at()') as set_updated_at,
       to_regprocedure('public.reject_immutable_columns()') as reject_immutable_columns,
       to_regprocedure('public.current_app_role()') as current_app_role,
       to_regprocedure('public.is_staff()') as is_staff,
       to_regprocedure('public.current_organization_id()') as current_organization_id,
       to_regprocedure('public.current_academic_year()') as current_academic_year;
```

---

## 2. SQL安全性レビュー

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 既存テーブル DROP | **しない** | `form3_records` のみ CREATE |
| 既存カラム ALTER | **しない** | 他テーブル未参照 |
| 既存 RLS 変更 | **しない** | `form3_*` ポリシーのみ |
| 既存 GRANT 変更 | **しない** | `form3_records` への GRANT のみ |
| 既存データ UPDATE/DELETE | **しない** | DML なし |
| form3 以外への副作用 | **なし**（関数本体も再定義しない） | トリガーは新テーブルのみ |
| 本番既存学習データへの影響 | **直接影響なし** | 新テーブル追加のみ。既存 `form2_records` 等は不変 |
| トランザクション | SQL Editor は文単位 autocommit が一般的 | 可能なら `begin; …; commit;` で一括適用を推奨 |
| SQL Editor 手動適用 | **問題なし**（プロジェクト慣例どおり） | `docs/version2/02_database.md` と同方式 |

### 再実行時の挙動

| 文 | 再実行 |
| --- | --- |
| `create table if not exists` | スキップ（既存定義と差分があっても **黙って成功**） |
| `create index if not exists` | スキップ |
| `drop trigger if exists` + `create trigger` | 冪等に作り直し |
| `drop policy if exists` + `create policy` | 冪等に作り直し |
| `grant …` | 冪等 |
| `comment on …` | 上書き |

**注意:** 途中失敗で「空の `form3_records` だけ残る」状態はあり得る。その場合はロールバック SQL（§6）で新オブジェクトだけ落としてから再適用する。  
**方針:** 既存 migration と同様、安易な追加の `IF NOT EXISTS` 化はしない（現状の冪等レベルを維持）。

### 部分適用のリスク

1. テーブル作成成功 → RLS 有効化前に中断 → **RLS 無効のテーブルが残る**（危険。すぐロールバックか RLS 有効化を完了させる）
2. RLS 有効・ポリシー未作成 → authenticated から見えない／書けない
3. GRANT 未実施 → permission denied

→ 適用は **全文を一度に実行**し、エラー時は §6 で巻き戻す。

### 0016 修正の要否

**コード変更は不要（修正案なし）。** 観察事項のみ:

- Form2 は `academic_year integer not null default 2026`、Form3 は **default なし**（profile 必須）。意図的で安全側。
- 学生 SELECT は Form2 同様 `user_id = auth.uid()` のみ（SELECT 時に org/year を見ない）。INSERT/UPDATE の WITH CHECK と不変トリガーで改ざんを抑止。Form2 整合のため変更しない。

---

## 3. RLS操作マトリクス

期待と `0016` ポリシーの一致を確認済み。

### 学生本人

| 操作 | 期待 | 実際の担保 |
| --- | --- | --- |
| 自分の SELECT | 許可 | `form3_select_own`（`user_id = auth.uid()`） |
| 自分の INSERT | 許可 | `form3_insert_own`（uid + role=student + org + year） |
| 自分の UPDATE | 許可 | `form3_update_own`（using/check 同様） |
| 自分の DELETE | **拒否** | DELETE ポリシーなし・GRANT なし |
| organization_id 改ざん INSERT/UPDATE | **拒否** | WITH CHECK で `current_organization_id()` |
| academic_year 改ざん | **拒否** | WITH CHECK で `current_academic_year()` |
| user_id 改ざん | **拒否** | WITH CHECK で `auth.uid()` |
| case_id 変更（UPDATE） | **拒否** | `reject_immutable_columns('case_id', …)` |

### 他学生

| 操作 | 期待 | 実際 |
| --- | --- | --- |
| 他学生 SELECT | 拒否 | own ポリシーは自 uid のみ。staff でも他組織は不可 |
| 他学生 UPDATE | 拒否 | update using が自 uid + student |
| INSERT で他学生 user_id | 拒否 | WITH CHECK `user_id = auth.uid()` |

### 同組織職員（teacher/admin）

| 操作 | 期待 | 実際 |
| --- | --- | --- |
| SELECT | 許可 | `form3_select_staff`（`is_staff()` + 自 org） |
| INSERT | 拒否 | insert は student のみ |
| UPDATE | 拒否 | update は student のみ |
| DELETE | 拒否 | ポリシー・GRANT なし |

### 他組織職員

| 操作 | 期待 | 実際 |
| --- | --- | --- |
| SELECT | 拒否 | staff ポリシーが自 org 限定 |
| UPDATE | 拒否 | update ポリシーなし（staff） |

### 未認証（anon）

| 操作 | 期待 | 実際 |
| --- | --- | --- |
| SELECT / INSERT / UPDATE | 拒否 | ポリシーは `to authenticated` のみ。anon へ GRANT なし |

---

## 4. GRANTレビュー

| 項目 | 結果 |
| --- | --- |
| authenticated に SELECT/INSERT/UPDATE | **付与** |
| authenticated に DELETE | **付与しない** |
| anon への GRANT | **なし** |
| service_role に ALL | **付与**（既存テーブルと同様。RLS バイパスは service_role の既定挙動） |
| GRANT だけで RLS 迂回 | **されない**（authenticated は RLS 適用。service_role のみバイパス＝管理用） |

---

## 5. Preview / 開発用 適用手順（人間・SQL Editor）

**まだ実行しない。承認後に実施。**

1. **対象プロジェクト確認**（Supabase Dashboard の Project URL / ref）
2. **Production ではないこと**を確認（プロジェクト名、URL、Vercel Production 紐付け）
3. `supabase/migrations/0016_form3_records.sql` を全文コピー
4. SQL 内容を目視（`form3_records` のみ・DELETE なし・既存 DROP なし）
5. SQL Editor で実行（推奨: `begin;` … `commit;`）
6. エラー有無を確認
7. テーブル存在確認
8. カラム・制約確認
9. RLS 有効確認
10. ポリシー確認
11. GRANT 確認
12. アプリ結合テスト（§8）

### 適用後確認 SQL（読み取り）

```sql
-- 7. テーブル
select to_regclass('public.form3_records');

-- 8. カラム
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'form3_records'
order by ordinal_position;

-- 8. 制約
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.form3_records'::regclass
order by conname;

-- 9. RLS
select relrowsecurity from pg_class where oid = 'public.form3_records'::regclass;

-- 10. ポリシー
select polname, polcmd, roles::regrole[]
from pg_policy
where polrelid = 'public.form3_records'::regclass
order by polname;

-- 11. GRANT（概要）
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'form3_records'
order by grantee, privilege_type;
```

期待ポリシー名:

- `form3_select_own`
- `form3_insert_own`
- `form3_update_own`
- `form3_select_staff`

期待 GRANT（authenticated）: `SELECT`, `INSERT`, `UPDATE` のみ（DELETE なし）。

---

## 6. Production 適用手順（別枠・今回は実施しない）

1. Preview / 開発で §5〜§8 を完了し、問題なしを確認
2. Production プロジェクトを明示確認（誤適用防止のダブルチェック）
3. メンテ窗口・バックアップ方針を確認（本 migration は追加のみだが、運用ルールに従う）
4. `0016` 全文を SQL Editor で適用
5. §5 の確認 SQL を Production でも実行
6. 講義用アカウントでのスモーク（load/save 1往復）のみ。破壊的テストは避ける
7. 問題時は §7 ロールバック（**Production ではテーブル DROP 前にデータ有無を必ず確認**）

---

## 7. ロールバック SQL（実行しない・問題発生時のみ）

**対象は今回追加分のみ。** 既存関数・既存テーブル・既存ポリシーは触らない。

```sql
-- form3_records ロールバック（0016 追加分のみ）
-- 実行前: select count(*) from public.form3_records; でデータ有無を確認すること。

begin;

drop policy if exists form3_select_staff on public.form3_records;
drop policy if exists form3_update_own on public.form3_records;
drop policy if exists form3_insert_own on public.form3_records;
drop policy if exists form3_select_own on public.form3_records;

drop trigger if exists trg_form3_records_immutable on public.form3_records;
drop trigger if exists trg_form3_records_updated_at on public.form3_records;

drop index if exists public.idx_form3_records_owner;

drop table if exists public.form3_records;

commit;
```

注意:

- `drop table` は `form3_records` のデータも消える。
- `set_updated_at` / `reject_immutable_columns` / RLS 補助関数は **残す**。

---

## 8. 実DB結合テスト計画（適用後）

アプリの Form3 UI / Hook は未実装のため、**Action 直叩き or ローカル検証スクリプト（service_role はサーバのみ）** を想定。

### A. 初回ロード

- 前提: 当該学生・ケースに `form3_records` 行なし
- `loadForm3Action(patientId)` → `ok: true, data: null`
- DB に INSERT されていないこと（count 不変）

### B. 初回保存

- `saveForm3Action({ patientId, payload, expectedVersion: null })`
- 期待: `kind: "saved"`、DB `version = 1`、`payload.schemaVersion = 1`、11キー存在、`patientId` がサーバ値

### C. 2回目保存

- `expectedVersion: 1` で更新
- 期待: `saved`、DB `version = 2`、入力保持

### D. 競合

- 同一行を version 1 として2クライアントが保持
- 一方が保存 → version 2
- 他方が `expectedVersion: 1` で保存 → `kind: "conflict"`、`latest` に最新 Snapshot、DB は version 2のまま（負け側の内容で上書きされない）

### E. 不正 isReviewed

- 根拠なし + `isReviewed: true`
- 期待: 保存成功、`isReviewed: false`、本文保持、`warnings` に `invalid_reviewed_reset`

### F. 情報不足

- `judgment: "insufficient_information"`、追加情報空、`isReviewed: true`
- 期待: reviewed false、本文保存、warning

### G. RLS（SQL / 検証スクリプト）

既存 `scripts/v2/verify-notebook.local.ts` の form2 パターンに倣う。

| ケース | 期待 |
| --- | --- |
| 他学生 SELECT | 0件 / 見えない |
| 他学生 UPDATE | 失敗または 0行 |
| INSERT で org/year/user 改ざん | 失敗（WITH CHECK） |
| 職員 SELECT 自組織 | 成功 |
| 職員 INSERT/UPDATE/DELETE | 失敗 |
| anon 全操作 | 失敗 |
| 学生 DELETE | 失敗 |

検証用メモ SQL（service_role / SQL Editor・**本番データでは使わない**）:

```sql
-- 適用後スモーク（件数のみ）
select count(*) as form3_rows from public.form3_records;
```

---

## 9. 推奨するテスト環境・方法

既存プロジェクトの慣例:

- DB 適用: **Supabase SQL Editor**（`02_database.md`）
- RLS 検証: **gitignore された `scripts/v2/*.local.ts`**（`verify-notebook.local.ts` 等。service_role はローカル env のみ）
- アプリ確認: **Vercel Preview** + 開発用学生アカウント

| 方法 | 安全性 | 推奨 |
| --- | --- | --- |
| Preview / 開発 Supabase + SQL Editor で 0016 適用 | 高 | **第一推奨** |
| 既存パターンのローカル検証スクリプト（新設は gitignore 配下） | 高（service_role をクライアントに出さない） | RLS・競合の詳細向き |
| 実アプリ画面から Action | UI 未実装のため不可（Day 3 以降） | Day 3 後 |
| Table Editor 手入力 | 中（identity 改ざんテストに不向き） | 目視確認のみ |
| ローカル Supabase | 高だがセットアップコスト | 任意 |
| Production で実験 | **不可** | 禁止 |
| 本番コードへデバッグ UI | **不可** | 禁止 |

**推奨フロー:** Preview/開発 DB に 0016 → 確認 SQL →（任意）local verify スクリプトで RLS → Day 3 Hook 後に Action 往復。

---

## 10. チェックリスト要約（適用 Go / No-Go）

Go 条件:

- [ ] 依存オブジェクトがすべて存在
- [ ] 対象が Production ではない
- [ ] 0016 に既存 DROP/ALTER/DML がないことを再確認
- [ ] ロールバック SQL を手元に用意
- [ ] 適用後確認 SQL の実行担当がいる

No-Go:

- Production への先行適用
- 依存未充足環境への単独適用
- service_role キーのクライアント露出

---

## 11. 変更履歴

| 日付 | 内容 |
| --- | --- |
| 2026-08-14 | 初版（適用前チェック・手順・ロールバック・結合テスト計画）。0016 未適用。 |
