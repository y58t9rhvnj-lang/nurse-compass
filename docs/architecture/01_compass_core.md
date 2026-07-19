# Compass Core Architecture

> 本書は Compass の恒久的アーキテクチャの中核 **Core** を定義する最上位文書のひとつです。
> これまでの「Version1 → Version2」という直列表現は**実装履歴・移行段階の呼称**としてのみ残し、
> 恒久アーキテクチャの名称には用いません。恒久アーキテクチャは次の3層で表します。
>
> - **Compass Core**（本書）— 臨床世界
> - **Compass Learning Layer**（`02_learning_layer.md`）— 学習支援能力
> - **Core-Learning Integration**（`03_core_learning_integration.md`）— 重畳の契約

---

## 1. Purpose

Compass Core の目的は「臨床世界そのものを提供すること」である。具体的には:

- **臨床環境を再現する** — 病棟・患者・電子カルテ・患者との対話といった、実際の臨床に近い場を提供する。
- **患者理解に必要な体験を提供する** — 学生・利用者が「情報を読み、話を聴き、文脈をたどる」ための一次体験を担う。
- **学習支援機能がなくても単独で成立する** — Learning Layer が無効（未ログイン・通常利用）でも、Core だけで完結した臨床閲覧体験として動作する。
- **学生専用画面ではない** — Core は特定ロール（学生/教員）に依存しない汎用の臨床UIである。
- **特定の保存基盤や認証方式に依存しない** — Core は Supabase・認証・学籍番号などの学習基盤を前提にしない。Core 単体は永続化基盤を必要としない（端末内状態や既存の localStorage 挙動の範囲で成立する）。

---

## 2. Core Definition

**Compass Core は「臨床世界（Clinical World）」である。**

Core は画面の集合ではなく、「臨床文脈を提示し、その中で利用者が患者理解を進めるための一次的な世界」を指す。学習の足場（Learning Layer）は Core の**上に**重畳されるものであって、Core の構成要素ではない。

### Core に含まれるもの

| 要素 | 意味 |
|---|---|
| **AppShell** | 全体の器。ナビゲーション・画面切替・臨床文脈の保持を担う単一シェル |
| **Ward** | 病棟という場（病棟ホーム） |
| **WardMap** | 病室・患者配置の地図。患者選択の起点 |
| **Patient** | 受け持ち／閲覧対象となる患者 |
| **Patient Top** | 患者の入口（基本情報・目標・観察ポイント・対話への導線） |
| **Electronic Chart** | 電子カルテ（診療録・看護記録・処方・検査・書類等） |
| **ChartSideNav** | 電子カルテ専用の左メニュー |
| **ChartAside** | 電子カルテ右の補助ペイン |
| **Conversation** | 患者との対話体験（FacingPatient） |
| **Notes** | 気づきメモ（NoteZone） |
| **Compass Coach** | 臨床思考を促す既存の支援UI（※責務整理は §4 の注記を参照） |
| **Core Navigation** | 病棟／患者／電子カルテ間の遷移と臨床文脈の維持 |
| **Design System** | Core の見た目・トーン・レスポンシブの共通言語（Apple ライクな静かなUI） |

---

## 3. Responsibilities

Core が責任を持つこと:

- 病棟・患者・電子カルテの**描画**。
- 患者との**対話体験**の提供。
- **臨床情報の提示**（記録・処方・検査等の閲覧）。
- **画面遷移と臨床文脈の維持**（どの患者を見ているか、どのカルテ画面かを保つ）。
- Core UI の**レスポンシブ対応**（PC / iPad 横 / iPad 縦）。
- **患者選択状態・カルテ閲覧状態の保持**（会話状態を患者別に保持する等）。

---

## 4. Non-Responsibilities

Core が責任を持たないもの（＝これらは Learning Layer 側の関心事）:

- 学生認証
- 学籍番号（学習者識別）
- 様式2（学習者による記録様式）
- Evidence
- Reflection
- Story
- 学習進捗
- Supabase への学生別保存
- 教員評価
- AI による学習支援

### 注記: Compass Coach の位置づけ

**Compass Coach** は現在 Core 内に存在する「臨床思考を促す支援UI」である（`FacingCoachPanel` 等）。本書時点では Core の一部として整理するが、その本質（学習者の思考を促す）は Learning Layer の Question / Inspector と重なる領域を持つ。

- 現状: Compass Coach は Core に属し、未ログインでも動作する既存機能として扱う。
- 将来: Coach の「思考を促す」責務は Learning Layer（Question / Inspector）へ寄せ、Core からは臨床提示に純化する方向で**責務の再整理が必要**である。この整理は `03_core_learning_integration.md` および将来スプリントで扱う（本書では未確定事項として明記するに留める）。

---

## 5. Core Invariants（不変条件）

以下は Learning Layer をどれだけ拡張しても破ってはならない Core の不変条件である。

1. **Core は Learning Layer なしで動作する。** `learningLayer` 未指定の Core（通常利用）は、学習基盤なしで完結する。
2. **Core の画面構造を Learning Layer が置き換えない。** Learning Layer は追加・重畳のみを行い、Core の列構成（例: 電子カルテの ChartSideNav ＋ 本体 ＋ ChartAside）を再構成しない。
3. **Core の主要画面は学習レイヤーの開閉で再マウントしない。** Inspector 等の開閉は Core のメイン領域を unmount させない（sibling / overlay として配置する）。
4. **Core の患者・カルテ・会話状態を Learning Layer が破壊しない。** 学習機能の開閉・保存が、選択中患者・カルテタブ・スクロール位置・会話入力を失わせてはならない。
5. **Core は特定の利用者ロールを前提にしない。** Core は「学生向け」でも「教員向け」でもなく、ロールは Learning Layer の設定として外から与えられる。

---

## 6. Current Implementation Mapping

現行コードとの対応（本書作成時点で確認した実パス）。**Core** に属する主な実装:

| Core 要素 | 実装ファイル |
|---|---|
| AppShell（単一シェル） | `components/AppShell.tsx` |
| Core Navigation / SideNav | `components/SideNav.tsx` |
| Ward（病棟ホーム上部） | `components/ward/WardHomeTopBar.tsx` |
| WardMap | `components/WardMap.tsx` |
| Ward 右ペイン | `components/WardRightPanel.tsx` |
| 病棟外エリア | `components/OutsideWardArea.tsx` |
| Patient Top / Conversation | `components/patient/facing/FacingPatient.tsx` |
| 初回課題シート | `components/patient/FirstAssignmentSheet.tsx` |
| Notes（気づきメモ） | `components/patient/notes/NoteZone.tsx` |
| Compass Coach（※§4注記） | `components/patient/facing/FacingCoachPanel.tsx` |
| Electronic Chart | `components/chart/CompassChart.tsx` |
| ChartSideNav | `components/chart/ChartSideNav.tsx` |
| ChartAside | `components/chart/ChartAside.tsx` |
| 患者・病棟データ | `lib/wardData.ts`（`PATIENTS` / `DEFAULT_PATIENT_ID`） |
| カルテタブ / ナビ定義 | `lib/chartTabs.ts` / `lib/chartNav.ts` |
| 会話状態モデル | `lib/patientFacingData.ts` |
| 機能フラグ | `lib/featureFlags.ts` |

### 補足: Core 内にあるが将来整理対象

- `components/thinking-workspace/ClinicalThinkingWorkspace.tsx` — 情報整理ノート（現在は feature flag `informationNotebook` で非表示）。学習寄りの責務を含むため、将来 Learning Layer との境界整理が必要。
- `components/form2/Form2Workspace.tsx`（および `Form2EditForm.tsx` / `Form2SheetView.tsx`）— **localStorage 版**の様式2表示/編集。Core 単体（通常利用）では localStorage 版が使われ、Learning Layer 有効時は Supabase 版へ差し替わる（`03_core_learning_integration.md` §7）。表示レイヤー（EditForm / SheetView）は Core・Learning 双方から共有される。

### 実装履歴（恒久名称ではない）

現行コードには `v1`（`/`）と `v2`（`/v2/*`）というパス・命名が残る。これらは**移行段階の呼称**として保持してよいが、恒久アーキテクチャ上は次のように読み替える。

- `/`（旧 V1）… Core のみ（Learning Layer 無効）
- `/v2/student`（旧 V2 学生導線）… Core ＋ Learning Layer 有効

---

## 7. 名称と移行方針（全文書共通）

- **Version1** … 現在の Core 実装を指す歴史的・実装上の名称。
- **Version2** … Learning Layer 導入を進めてきた開発段階の名称。
- 恒久的な製品アーキテクチャは **Core / Learning Layer / Integration** で表現する（Version1 / Version2 は恒久名称に用いない）。
- `/v2` ルートと `docs/version2` は移行中の技術資産として当面残す。
- 今回はルート名変更・ファイル移動・コード変更を行わない。

---

## Migration Notes

### 継続採用
- 静けさ・信頼性・思考支援・「AI を主役にしない」。
- Core の臨床 UI（Ward / Patient / Chart / Conversation / Notes）と Design System。
- 患者選択・カルテ閲覧状態の保持（Core が所有）。

### 名称・位置付けを変更
- 「Workspace First」→ **Clinical World First / Core First**（最初に見えるのは学習ツールでなく臨床世界）。
- CWDS（`docs/version2/13_ui_architecture.md`）が主役に置いた「Workspace 縦フロー」→ 本アーキテクチャでは Core の各 view が主役、学習は重畳。

### 廃止予定
- `mode="v2"` による AppShell 全体の別描画（Core 置換）。
- Core を置き換える独立 Workspace 中心構造 / StudentShell。

### 実装移行が必要
- AppShell を「Core の単一シェル」として維持したまま `learningLayer` 接続点を持たせる。
- `components/form2/*`（localStorage）と Supabase 版様式2 の切替を Core view 内で行う。

> 既存 `docs/version2/13_ui_architecture.md`（CWDS）の「Workspace First」「Workspace Inspector」は、Core を主役とする本アーキテクチャと**名称・主従が矛盾**する。既存文書は変更せず、本 `docs/architecture/` を上位の恒久定義として扱う。
