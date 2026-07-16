# 05. Information Notebook 設計レビュー — Compass Version2 β（Phase 3 前）

Status: Design Review（Phase 3 実装前の合意ドキュメント）
Last Update: 2026-07-16
関連: `docs/03_Information_Organization_Workspace.md`（確定モデル）、
`docs/02_Information_Card_Model.md`、`docs/version2/03_learning_journey.md`、
`docs/version2/04_patient_understanding.md`

> 本書は Phase 3（Information Notebook / 様式2 の Supabase 保存）に入る前の
> **現状整理と β 最小設計の合意**を目的とする。ここで確定した方針に基づき Phase 3 を開始する。

---

## 0. 結論（最重要）

- 「Information Notebook」は**名称はあるが実体は骨格段階**。動作するのは Stage1（データ収集・一覧・編集・解除）まで。
  Stage2（情報整理）・Stage3（手がかり）の **UI は未実装**、V1 本番では導線ごと非表示。
- **確定ドキュメント（docs/03）と現行コードが乖離**している。
  - 確定モデル: データ(`InformationCard`) → 情報(`InformationGroup`：テーマ＋S/O分類・**解釈文なし**) → 手がかり(`Cue`：学生の解釈)
  - 現行コード: `OrganizedInformation`（**title/content を持つ暫定実装**）。docs/03 §3.8 で明確に否定済。
- β 方針（合意）:
  1. **Supabase 保存対象は「様式2」＋「情報カード（データ）」**（実装済で低リスク）。
  2. **情報モデルは暫定 `OrganizedInformation` を廃し、確定 `InformationGroup` / `Cue` を採用**（Phase 3 で再設計）。
     暫定実装の localStorage データは Supabase へ持ち越さない。
  3. 情報(Stage2)/手がかり(Stage3) の Supabase 永続化・UI は、確定モデルの上で段階導入する
     （β 講義の必須は 様式2＋カード保存。Stage2/3 は確定モデル基盤の整備を優先）。

### 決定記録（2026-07-16）

| 論点 | 決定 |
| --- | --- |
| β の Supabase 保存範囲 | 様式2 ＋ 情報カード（データ） |
| 情報(Information)モデル | 確定モデル（InformationGroup / Cue）へ再設計。暫定 OrganizedInformation は持ち越さない |
| 本レビューの保存 | `docs/version2/05_information_notebook.md` として保存 |

---

## 1. 現状の実装ステータス

| 段階 | 確定モデル(docs/03) | 現行コード | UI | フラグ |
| --- | --- | --- | --- | --- |
| データ (Data) | `InformationCard`（事実・不変） | ✅ store/検証/localStorage/収集 実装済 | ✅ 左ペインのみ | `collection: false` |
| 情報 (Information) | `InformationGroup`（テーマ＋S/O・解釈文なし） | ⚠️ `OrganizedInformation`（title/content・履歴）暫定 | ❌ 空スケルトン | `informationNotebook: false` |
| 手がかり (Cue) | `Cue`（解釈・根拠必須） | ❌ 未実装（型なし） | ❌ 空スケルトン | 〃 |

V1 本番では `informationNotebook=false` / `collection=false` により Notebook 導線は完全非表示。

## 2. 画面構成（現状）

内部名 `ClinicalThinkingWorkspace`（学生向け表示名「情報整理ノート」）。
iPad 横（lg 以上）で 3 ペイン、狭い画面ではセグメント（データ / 情報整理 / 手がかり）で 1 領域ずつ表示。

```
┌──── 情報整理ノート（患者名 / 戻る） ────┐
│  データ(32%)        │  情報整理(flex)      │
│  収集カード一覧      │  「まだテーマはありません」← 空
│  ・内容を修正        │                      │
│  ・収集解除          │                      │
├────────────────────┴──────────────────────┤
│  手がかり（CuePane）  ← 空状態              │
└────────────────────────────────────────────┘
```

- 実装済: `CollectedDataPane`（一覧・編集ダイアログ・収集解除確認）
- 未実装: `InformationOrganizationPane`（テーマ作成／S・O分類）、`CuePane`

## 3. データ構造（現状）

- `InformationCard`（`lib/information/`）
  `id / patientId / content / sourceType(12種) / sourceLabel / sourceReference? / createdAt / createdBy / category? / note? / originalText? / observedAt? / updatedAt?`
  出所を保持し不変（証拠）。
- `OrganizedInformation`（`lib/organization/`・**暫定**）
  `id / patientId / title / content / sourceDataIds[] / revision / previousRevisionId? / status?` ＋ `OrganizedInformationRevision[]`（追記履歴）。
  → docs/03 §3.8 の確定方針では不採用。`InformationGroup` ＋ `Cue` へ再設計する。

## 4. 保存単位（現状・すべて localStorage・患者別）

| 対象 | キー | 単位 | version |
| --- | --- | --- | --- |
| データ | `nc:information-cards` | 全患者を1オブジェクト（`cardsByPatient`） | 1 |
| 情報 | `nc:organized-information` | 全患者＋履歴を1オブジェクト | 1 |
| 様式2 | `compass:v2:form2:{patientId}` | 患者ごとに1レコード | 1 |
| 一時メモ(気づき) | `lib/notes.ts`（別系統） | 患者別。自動でカード化しない | - |

いずれも `useSyncExternalStore` ＋安定参照＋破損時は空フォールバックで統一。

## 5. 様式2との関係

- docs 上、様式2は Stage3「表現」（データ→情報→手がかり の後段）。
- 現状は**完全に独立**。様式2はノートから自動転記せず、学生が全項目手入力（自動表示なし）。
- 将来（docs/03 §3.9）は「ノートの情報・手がかりを様式2へ引用」できる設計。β では実装しない。

## 6. Thinking Guide との関係

- Thinking Guide という**機能は現状コードに存在しない**。docs では Journey の `source` 値（`thinking_guide` ＝ Compass の思考ガイド）として名前のみ定義。
- 学生の思考支援は現状 Compass Coach（`FacingCoachPanel`）。原則「答えを与えない／自動生成・自動分類・自動要約をしない」（docs/03 §3.10 / §8）。
- **β では対象外**（Journey の source として将来枠のみ維持）。

## 7. Patient Understanding との将来拡張

- `docs/version2/04` にて「患者理解＝版を重ねる過程」で設計済（head `patient_understandings` ＋ 追記履歴 `patient_understanding_revisions`、検索用カラム `summary/strength/difficulty/support_direction` ＋ `payload jsonb`）。テーブルは未作成。
- Notebook（データ→情報→手がかり）は、患者理解を更新する**入力源**。Journey の `ref_type` で `notebook_entry` / `form2` / `understanding_revision` を束ねる。
- **β では Patient Understanding テーブルは作らない**（設計のみ維持）。

---

## 8. β 最小設計（Phase 3 の実装対象）

方針: 未完成の Stage2/3 を一週間で無理に作らず、**完成済み機能を Supabase 保存対応**にする。
情報モデルは暫定を廃し、確定 `InformationGroup` / `Cue` を採用（基盤を正す）。

### 8.1 用語

- `patientId` は V2 用語の **`case_id`**（教育ケース。例 `SP-001`。Patient A は暫定 `A`）に読み替える。

### 8.2 Phase 3 の Supabase テーブル（head 方式）

```sql
-- 様式2（1人1ケース1レコード。Form2Data を JSONB で丸ごと保持）
create table public.form2_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  case_id         text not null,
  organization_id uuid not null references public.organizations(id),
  academic_year   integer not null default 2026,
  payload         jsonb not null,          -- Form2Data（version 含む）
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, case_id, academic_year)
);

-- 情報カード（データ＝事実。1カード1行）
create table public.information_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  case_id          text not null,
  organization_id  uuid not null references public.organizations(id),
  academic_year    integer not null default 2026,
  content          text not null,
  source_type      text not null,          -- 12種の出所種別
  source_label     text not null,
  source_reference jsonb,
  category         text,
  note             text,
  original_text    text,
  observed_at      timestamptz,
  created_by       text not null default 'student',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

RLS（Phase 2 の `is_staff()` / `current_organization_id()` を流用）:
- student: `user_id = auth.uid()` で SELECT / INSERT / UPDATE（INSERT・UPDATE は `WITH CHECK (user_id = auth.uid())` 必須）。
- teacher / admin: 自組織を **SELECT のみ**（学生データを書き換えない）。
- service_role: 管理用途のみ（一般データアクセスには使わない）。
- 明示 GRANT（`0004_grants.sql` と同方針）を各テーブルにも付与。

フォールバック: Supabase 保存失敗時は localStorage に一時退避（既存 store をキャッシュとして流用）。

学習ログ: β は最小限（`update_form2` / `open_chart` 等のイベントのみ、内容の before/after は保存しない）。テーブル本体は Phase 4 以降。

### 8.3 情報モデルの再設計（確定 InformationGroup / Cue）

暫定 `OrganizedInformation`（title/content）を廃し、docs/03 §3.8 の確定モデルへ移行する。
localStorage の暫定データは Supabase へ**移行しない**（β 開始時点で情報整理は未使用のため実害なし）。

```ts
// 情報（テーマ別に整理・分類されたデータのまとまり。解釈文は持たない）
type InformationGroup = {
  id: string;
  caseId: string;
  title: string; // テーマ名のみ（解釈文ではない）
  dataReferences: {
    dataId: string; // InformationCard.id を参照（本文は複製しない）
    classification: "subjective" | "objective" | "unclassified";
    order: number;
  }[];
  createdAt: string;
  updatedAt: string;
  createdBy: "student";
};

// 手がかり（学生の解釈・方向性。必ず根拠データに結びつける）
type Cue = {
  id: string;
  caseId: string;
  informationGroupId: string;
  content: string;
  evidenceDataIds: string[]; // 根拠となる InformationCard.id
  createdAt: string;
  updatedAt: string;
  createdBy: "student";
};
```

将来の Supabase テーブル（β では作成せず、確定モデルとして設計のみ）:

```sql
-- 情報グループ（将来）
create table public.information_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  organization_id uuid not null references public.organizations(id),
  academic_year integer not null default 2026,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 情報グループ内のデータ参照（S/O分類・順序）
create table public.information_group_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.information_groups(id) on delete cascade,
  data_id uuid not null references public.information_cards(id) on delete cascade,
  classification text not null check (classification in ('subjective','objective','unclassified')),
  sort_order integer not null default 0
);
-- 手がかり（将来）
create table public.cues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  organization_id uuid not null references public.organizations(id),
  information_group_id uuid references public.information_groups(id) on delete set null,
  content text not null,
  evidence_data_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

> β の実装順としては、まず 8.2（様式2＋カード保存）を完成させ、確定 `InformationGroup`/`Cue` の
> 型・store 基盤を整備する。UI（情報整理／手がかりペイン）と上記テーブルの本実装は、
> 講義必須ではないため確定基盤の上で段階導入する。

### 8.4 β で「やらないこと」

- 情報整理ペイン・手がかりペインの本 UI 実装（確定モデル基盤整備までに留める）
- 暫定 `OrganizedInformation` の Supabase 化・データ移行
- 様式2 ⇄ ノートの相互引用
- Patient Understanding / Learning Journey テーブル作成
- Thinking Guide 機能
- 学習ログの内容（before/after）保存、自動採点・順位付け・学生間比較

---

## 9. 実装順（Phase 3）

1. `form2_records` / `information_cards` テーブル＋RLS＋GRANT のマイグレーション作成（手動適用）。
2. Supabase 保存クライアント（既存 localStorage store の裏側を DB 同期に拡張、失敗時フォールバック）。
3. 様式2の DB 保存・復元（`case_id` 単位・head 上書き＋`updated_at`）。
4. 情報カードの DB 保存・復元（1カード1行・収集/編集/解除を反映）。
5. 確定 `InformationGroup` / `Cue` の型・store 基盤整備（UI・テーブル本実装は後続）。
6. 検証（TS / Lint / Build / RLS 実データ確認・V1 無影響）→ 報告 → 承認後コミット。

## 10. 関連ドキュメント

- `docs/03_Information_Organization_Workspace.md` — データ→情報→手がかり の確定モデル
- `docs/02_Information_Card_Model.md` — 情報カードのドメインモデル
- `docs/version2/01_architecture.md` — V2 全体構成
- `docs/version2/03_learning_journey.md` — Learning Journey 設計
- `docs/version2/04_patient_understanding.md` — Patient Understanding 設計
