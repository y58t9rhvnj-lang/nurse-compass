# Compass Version3 — Workspace Shell / Form2 / Form3 全体 UI レビュー

- 文書種別: **設計レビュー**（実装承認前）
- 対象ブランチ: `feature/version2-form3`
- 作成日: 2026-08-19
- 前提: Phase B UI Redesign **R1・R2 完了**（左=患者参照、右=ゴードン Pattern 別 Info/Assess、Final=「様式表示」）
- 制約: **承認前にページ削除・ルート変更・大規模実装・コミット・push は行わない**

---

## 1. 現在の学生向けページ構成

V2 学生の正本導線は **単一 URL** `/v2/student` 上の **AppShell 内 view 切替**である。URL が変わるのはログイン・別スタンドアロンページ程度。

| 表示名（ナビ） | 実体 | URL | 主なコンポーネント | 役割 |
| --- | --- | --- | --- | --- |
| 学生ホーム相当 | AppShell `ward` | `/v2/student` | Ward / WardMap | 病棟・症例選択の起点 |
| 患者トップ | `patient-top` | 同上 | Patient top UI | 受け持ち患者概要・会話/カルテへの入口 |
| 電子カルテ | `chart` | 同上 | CompassChart（Core） | カルテ単独閲覧 |
| 思考ワークスペース | `clinical-workspace` | 同上 | LearningLayer → Form2Workspace | **様式2 編集**＋左カルテ/会話＋Inspector |
| 様式2 | `form2` | 同上 | Form2ReviewScreen | **最終確認・印刷・提出 UI**（編集なし） |
| 様式3 | `form3` | 同上 | LearningLayer → Form3PhaseBWorkspace（Flag ON時） | Pattern 別 Info/Assess |
| （内部）Evidence 整理 | `evidence-review` | 同上 | EvidenceReviewWorkspace | 根拠リンク整理。ナビ非表示 |
| （別ルート）旧 Workspace | — | `/v2/student/workspace` | PatientWorkspace | スタンドアロン思考 WS 相当 |
| （別ルート）旧 Form2 編集 | — | `/v2/student/form2` | Form2SupabaseWorkspace | スタンドアロン様式2編集 |
| 教員ホーム | — | `/v2/teacher` | placeholder | Form 参照なし（Phase 2） |
| ログイン | — | `/v2/login` | LoginForm | 認証 |

### 保存・印刷・提出・戻る（要約）

| 画面 | 保存 | 印刷 | 提出 | 戻る |
| --- | --- | --- | --- | --- |
| 思考 WS（Form2） | Supabase autosave（`useForm2Supabase`） | 様式表示モード時 `window.print` | なし（ナビ「様式2」へ誘導） | SideNav のみ |
| ナビ「様式2」 | 読取（同一 Form2） | `window.print` + `@media print` | **端末内 UI のみ**（DB 提出なし） | SideNav / 編集へ誘導文 |
| 様式3 Phase B | V2 Autosave | **未実装** | **未実装**（整理済み≠提出） | SideNav のみ |
| `/v2/student/form2` | 同上 autosave | あり | なし | ヘッダーで `/v2/student` へ |

### 重複

1. **様式2 編集**: `clinical-workspace` の Form2Workspace ≒ `/v2/student/form2` の Form2SupabaseWorkspace  
2. **様式2 プレビュー**: ナビ `form2`（Form2ReviewScreen）と、編集側の「様式表示」モード（Form2SheetView 共有）  
3. **患者参照**: Form2 左（chart+会話）と Form3 R1 左（chart+会話+メモ）が類似。共通 Pane は R1 で抽出済みだが Form2 未置換

---

## 2. 各ページの役割（詳細）

### 2.1 思考ワークスペース（`clinical-workspace`）

- **役割**: カルテ・会話を見ながら **様式2 を編集**する集中作業空間  
- **データ**: Form2 payload（Supabase）＋ Facing 会話 state＋ Compass メモ（Inspector）＋ 患者理解テキスト  
- **共用範囲**: LearningLayer の器は Form3 と共用。中央ホストだけ差し替え。Inspector（Coach/Note）は **clinical-workspace のみ**重畳  
- **結論**: 学生向け実質は **様式2 作成専用**。表示名を「様式2」に寄せる案は妥当（内部 view 名・コンポーネント名は即変更不要）

### 2.2 ナビ「様式2」（`form2` → Form2ReviewScreen）

- 編集不可。Form2SheetView で原本レイアウト表示  
- 未入力チェック、印刷、提出ボタン（ローカル confirm）  
- 患者参照ペインなし。SideNav は表示されたまま

### 2.3 様式3（`form3`）

- Flag ON: Form3PhaseBWorkspace（R1/R2）  
- Flag OFF: 旧 Form3Workspace（v1 パターン編集）  
- 保存のみ。印刷・提出なし

### 2.4 症例選択

- 病棟ホームの患者タイル選択（遷移は自動でない場合あり。受け持ちは表示で示す）  
- 学習対象外患者は LearningLayer / Form2Review でロック UI

---

## 3. 思考ワークスペースと様式2の重複

| 観点 | 思考 WS | ナビ「様式2」 |
| --- | --- | --- |
| 編集 | ○ | × |
| 患者参照 2 ペイン | ○ | × |
| 印刷 | △（様式表示時） | ○ |
| 提出 UI | × | ○（端末内） |
| 学習導線上の位置 | 作成 | 最終確認 |

**推奨学生向け命名**

- ナビ「思考ワークスペース」→ **「様式2」**（作成）  
- 現行ナビ「様式2」→ **廃止または「様式2 確認」**（印刷・提出を作成画面ヘッダーへ移設後）

内部: `clinical-workspace` / `Form2Workspace` は当面維持でよい。

---

## 4. 様式2統合可否

**統合は可能かつ推奨。**

新「様式2ワークスペース」= 現思考 WS を正本とし、ヘッダーに:

- 戻る / 保存状態 / プレビュー（様式表示） / 印刷 / 提出  

を載せ、ナビ専用の Form2ReviewScreen を段階的に降格する。

阻害要因:

- 提出が **DB 契約なし**（UI のみ）。移設はボタン位置変更で足りるが、本物の提出は別 Phase  
- Inspector が clinical-workspace 専用。集中モード後も Coach/メモ配置を決める必要あり（メモは左ペインに寄せる案あり＝Form3 R1 と揃える）

---

## 5. 旧様式2画面の必要性

ここでの「旧様式2」は二層ある。

| 対象 | 必要性 |
| --- | --- |
| ナビ `form2`（Form2ReviewScreen） | 印刷・提出 UI の現拠点。機能移設まで必要 |
| `/v2/student/form2` | AppShell 外の編集ページ。**正本導線外**。教員参照なし |

教員・ブックマーク・テストの外部参照は **ほぼ AppShell view**。スタンドアロン URL 依存は薄い。

---

## 6. 様式3の現在構造

```
AppShell + SideNav(204px)
  └ LearningLayer
       └ Form3PhaseBWorkspace
            ├ 左 (≥1024): WorkspacePatientReferencePane
            └ 右: Pattern TabBar + Info + Assess
                 └ 「様式表示」→ Final Editor
```

- 狭幅: 患者参照 Sheet、「一覧」Pattern Sheet  
- データ: Form3 V2 + Autosave。閲覧 UI 状態は提出データに含めない（R2 の sessionStorage Pattern）

---

## 7. 集中作業モード

**目的**: 様式2・3で SideNav（通常コンパスメニュー）を隠し、横幅を作業に回す。病棟・患者トップ等は現状維持。

**判定**: AppShell の `activeView` が `clinical-workspace` | `form3`（将来は統合後の様式2 view）のとき。

**実装候補比較**

| 案 | 内容 | 評価 |
| --- | --- | --- |
| **A. 専用 Layout ルート** | `/v2/student/form2-ws` 等を新設 | URL 変更・導線再配線が大きく、今回は重い |
| **B. 集中モード prop** | AppShell / LearningLayer に `focusMode` | 既存 view 状態を活かせる |
| **C. ルート単位 Sidebar 非表示** | 現状 view は URL ではないため不適合 | — |

**推奨: B**（`focusMode={isLearningWorkspaceView(activeView)}`）。SideNav を条件レンダーしない。通常画面は不変。

---

## 8. 共通 FormWorkspaceShell

候補名: **`FormWorkspaceShell`**

```
FormWorkspaceShell
├ header（戻る / 様式名 / 患者名 / persist / 様式表示|プレビュー / 印刷 / 提出）
├ body: ResizableTwoPane
│   ├ leftSlot: WorkspacePatientReferencePane
│   └ rightSlot: Form2 中央 or Form3 Pattern WS
└ narrow: 患者参照 Sheet トリガー
```

- Form2 / Form3 で **Shell を二重実装しない**  
- R1 の `WorkspacePatientReferencePane` を左 slot に固定再利用  
- Phase B の Final / Pattern は rightSlot 内の責務のまま（Shell は知らない）

---

## 9. コンパスメニュー非表示方法

1. AppShell で `focusMode` 時、`studentSideNav` を描画しない  
2. LearningLayer の `{sideNav}` も同様に空  
3. フォーカス中はヘッダー「戻る」が唯一の主要脱出導線  

Mobile / 将来の下部ナビがある場合も、様式2・3では出さない（現状 V2 学生は左 SideNav 主）。

---

## 10. 戻る導線

**推奨戻る先: 患者トップ（`patient-top`）**

理由:

- 受け持ち患者コンテキストを維持したまま学習ハブへ戻れる  
- 病棟ホームだと症例再選択が必要で予測しづらい  
- 「直前 view」ヒストリは AppShell が履歴スタックを持たないため不安定  

実装: `onBack={() => goPatientOverview()}` 等。**ブラウザ履歴だけに依存しない。**

保存状態別（処理自体は変更せず、文言・待機のみ）:

| 状態 | 戻る時 |
| --- | --- |
| Saved / Ready | 確認なし |
| Saving | 「保存中です」短時間待機 or 案内 |
| Draft | Autosave 促進（既存 debounce を待つ）案内 |
| Save failed / Conflict | 警告ダイアログ（契約は触らない） |

---

## 11. ヘッダー構成

高さは 1 段・`min-h` 44px 操作を優先。様式名は短く。

**共通左**: `← 戻る` | 様式名 | 患者名  
**共通右**: persist バッジ | （様式固有） | 印刷 | 提出  

| | 様式2 | 様式3 |
| --- | --- | --- |
| 様式固有 | プレビュー（様式表示トグル） | 様式表示（Final Artifact） |
| 印刷 | Form2SheetView + 既存 print CSS | **要新設**（Final または学校様式） |
| 提出 | ReviewScreen 相当 UI を移設 | **契約未実装** → ボタンは disabled または非表示（Phase 明示） |

ヘッダー肥大防止: 二次操作はメニュー化可。Final 表示中は Pattern タブを隠し「Patternへ戻る」をヘッダーに出す（R2 現状と整合）。

---

## 12. Resizable Two Pane

**要件対応案**

- 中央に `role="separator"` のドラッグハンドル  
- マウス + touch（`pointer` イベント）  
- ドラッグ中 `user-select: none` / `touch-action: none`  
- 左右とも `min-w-0` + 明示 `minWidth` px  
- 親は `overflow-hidden`、画面全体横スクロール禁止  
- ドラッグ中も **子を remount しない**（幅は style / CSS 変数のみ）

**推奨初期比率: 左 38% / 右 62%**（現行 Form3 `min(42%,28rem)` と Form2 固定 300–380px の中間。カルテ可読と入力幅の両立）

---

## 13. 幅の保存

- **localStorage** に **比率（0–1）** を保存  
- Form2/Form3 **提出データに含めない**  
- キー推奨: **共通 1 キー**  
  - 例: `compass:form-workspace:split-ratio`  
  - 理由: 同じ患者参照ペインを共有。様式別だと再学習コストが高い。必要なら後で `:form2` / `:form3` に分岐  

画面リサイズ時は `clamp(minLeft, stored*width, maxLeft)` で補正。

---

## 14. 幅のリセット

iPad 発見性優先:

1. **ハンドルダブルタップ / ダブルクリック**で初期比率（第一候補）  
2. ヘッダー「レイアウトを戻す」（狭い画面やアクセシビリティ用）  

コンテキストメニューは iPad で弱い。小ボタンは誤タップしやすいので第二候補。

---

## 15. PC

- SideNav 非表示 + 2 ペイン常時  
- リサイズ可  
- 左最小目安 **320px**、右最小 **520px**（実機で再測定）  
- 右は Pattern タブ横スクロールをペイン内に閉じる

---

## 16. iPad 横向き

- 集中モード必須（204px SideNav 回収が効く）  
- 常時 2 ペイン、タッチリサイズ  
- 日本語キーボード: `visualViewport` で右ペイン下部余白（実装は C10）  
- 電子カルテは左ペイン内 `overflow-x-auto` に閉じ込め、右を押し出さない（§22）

---

## 17. iPad 縦向き

- 右作業を主表示  
- 患者参照は Sheet（R1 方式）  
- リサイズハンドル非表示  
- Pattern 横スクロール +「一覧」維持

---

## 18. Split View

- ブレークポイントは **幅のみ**（現行 lg=1024 と揃えるか、集中モード後は 900 前後を再検討）  
- 十分な幅: 2 ペイン + リサイズ  
- 狭い: 右主 + Sheet  

---

## 19. 印刷の移設

### Form2（既存）

- トリガー: `window.print()`  
- 対象: `.form2-print-root`（`Form2SheetView`）  
- CSS: `app/globals.css` `@media print`（`.no-print` 非表示、A4）  
- PDF ライブラリなし  

**移設**: ヘッダー「印刷」→ プレビュー表示状態を保証してから `window.print()`。カルテ・会話・メモ・タブ・ハンドル・persist はすべて `no-print`。

### Form3

- **印刷パイプライン未存在**  
- 候補対象: Final Form Artifact（学校指定 2 欄 × 11）  
- C フェーズで「ヘッダーに印刷を置く」なら、**Final 印刷専用ルート or print CSS 新設**が別タスク。契約を作らず UI だけ置く場合は disabled + 説明

---

## 20. 提出の移設

### Form2

- 現状: Form2ReviewScreen のローカル `submitted` state のみ  
- **同じ Action・同じ「非 DB」契約のまま**ヘッダーへ移せる  
- 未入力チェック `collectMissing` を共有関数化して再利用  

### Form3

- Validation コメント通り **提出条件未実装**  
- ヘッダー提出は **出さない / または将来用プレースホルダ**（契約新設は本レビュー範囲外）

教員レビュー UI・ロック列は未実装。移設で教員契約を増やさない。

---

## 21. 旧様式2ページの廃止・残置比較

| 案 | 内容 | 推奨度 |
| --- | --- | --- |
| **A. 学生導線から外し、旧 URL を新様式2へリダイレクト** | `/v2/student/form2` → `/v2/student` + view クエリ or 廃止案内 | **推奨（スタンドアロン）** |
| **B. 提出済み閲覧専用** | DB 提出状態が無いため時期尚早 | 保留 |
| **C. 印刷専用内部** | print CSS が SheetView 直で足りる | 不要寄り |
| **D. 完全削除** | テスト・ドキュメント更新後 | A の後続 |

ナビ `form2`（ReviewScreen）:

- 印刷・提出移設完了後 → **学生メニューから外す**  
- 当面は「確認」別名で残すか、A 相当で作成画面へ誘導  

**推奨パッケージ**: スタンドアロン `/v2/student/form2` は **A**。ナビ Review は機能移設後にメニュー削除（内部コンポーネントは一時残置可）。

---

## 22. 電子カルテ時の右ペイン消失 — 原因

### 観測（R1/R2 構成）

- 左タブ「電子カルテ」でのみ右（Pattern / Gordon）が消える・画面外へ押し出される  
- 「会話」「コンパスメモ」では起きにくい  

### 分類

| 仮説 | 判定 |
| --- | --- |
| A. React state / データ消滅 | **否定寄り**（タブは CSS `hidden` で常時 mount。切替でデータ破棄しない） |
| B. DOM はあるが CSS で押し出し | **最有力** |
| C. 条件分岐で非描画 | **否定**（chart 時だけ right を消す分岐は Workspace に無い） |

### 技術原因（推定）

Flex アイテムのデフォルト `min-width: auto` により、**内容の最小コンテンツ幅が指定 width を上回ると左 aside が膨張**する。

証拠:

- `ChartTable`（`ChartUi.tsx`）: `table.min-w-[600px]`（外側は `overflow-x-auto` だが、祖先に `min-w-0` が無いと min-content が親へ伝播しうる）  
- Flowsheet / Exams 等も `min-w-[…]`・横スクロール表  
- Form3 左 aside: `w-[min(42%,28rem)] min-w-[20rem] shrink-0` だが **`min-w-0` / `overflow-hidden` 不足**  
- `WorkspacePatientReferencePane` / chart ラッパも `min-w-0` 未徹底  
- 会話・NoteZone は広い table min-width を持たない → 膨張しない  

結果: 左が 600px 超に広がり、右 `flex-1` が幅 0 付近まで圧縮され「消えた」ように見える。

### 修正方針（実装は C5。本レビューではコード変更しない）

1. 左ペイン連鎖に `min-w-0` + `overflow-hidden`  
2. カルテ内部の横スクロールを **左ペイン内で完結**（既存 `overflow-x-auto` を活かす）  
3. aside に `max-w` またはリサイズ後の上限  
4. 回帰: 会話/メモ切替、フィルタ、ページ送り、右 Pattern タブ可視  

検証手順（C5）: DevTools で右ペインの `getBoundingClientRect().width` と左の scrollWidth を比較。DOM 残存を確認。

---

## 23. データモデルへの影響

**変更しない（必須）**

- Form2 / Form3 V2 保存契約、schemaVersion、Autosave Controller、Evidence ID、Final、revision/Conflict  

**UI のみ（提出データ外）**

- split 比率（localStorage）  
- 選択 Pattern（既存 sessionStorage）  
- 患者参照タブ  
- focusMode / 戻る先  

---

## 24. Autosave / Conflict への影響

- Shell・リサイズ・SideNav 非表示は **保存経路に触れない**  
- 戻る時の案内は UX のみ  
- Conflict / Save failed の契約・再試行 UI は本 Phase で新設しない（RC 既知 Must は別管理）

---

## 25. 実装フェーズ

| Phase | 内容 | 依存 | Phase B との関係 |
| --- | --- | --- | --- |
| **C1** | 本レビュー（本書） | R1–R2 | — |
| **C2** | FormWorkspaceShell 骨格 | C1 承認 | R1 Pane を slot 化 |
| **C3** | focusMode（SideNav 隠す）+ 戻る | C2 | Form3/Form2 両方 |
| **C4** | Resizable Two Pane + 保存/リセット | C2 | 左 remount 禁止 |
| **C5** | カルテ時右ペイン消失修正 | C4 前後可 | **R3 前に推奨**（入力 Dialog 前にレイアウト安定） |
| **C6** | 思考 WS を様式2表示名＋Shell 適用 | C3 | Form2 左を共通 Pane へ任意置換 |
| **C7** | 印刷・提出を様式2ヘッダーへ | C6 | ReviewScreen 降格開始 |
| **C8** | 旧 `/v2/student/form2`・ナビ form2 整理 | C7 | リダイレクト案 A |
| **C9** | 様式3 へ Shell 全面適用 | C2–C5 | R2 維持。R7 Final とヘッダー「様式表示」整合 |
| **C10** | PC / iPad / Split 回帰 | C9 | R8 と重複調整 |

**Phase B R3 以降**

- R3–R6（Dialog 化）は **C5 完了後が安全**  
- R7（Final 本配置）は C9 ヘッダー「様式表示」と設計を揃える  
- R8 と C10 は統合計画を推奨  

---

## 26. リスク

| リスク | 影響 | 緩和 |
| --- | --- | --- |
| SideNav 隠しで迷子 | 脱出不能感 | 明確な戻る・患者名表示 |
| リサイズでカルテ再発火 | 右ペイン再消失 | C5 を C4 とセット検証 |
| Form2 提出が「本物」と誤解 | 学習・評価事故 | 文言で「確認」と明示。DB 提出は別 Phase |
| Form3 印刷未実装のままボタン設置 | 期待外れ | disabled + 説明、または Final のみ後続 |
| Shell 共通化で Form2 Inspector 喪失 | Coach/メモ導線 | 左メモ or ヘッダーから Inspector 再配置を C6 で決定 |
| `/v2/student/form2` 削除のテスト壊れ | CI | リダイレクト期間を置く |
| focusMode 判定漏れ | SideNav 残存 | view 定数を一箇所に集約 |

---

## 27. 推奨案（総括）

1. **思考 WS を学生向け「様式2（作成）」の正本とする**（内部名は維持可）  
2. **ナビ「様式2」Review の印刷・提出 UI を作成画面ヘッダーへ移し、メニューから段階廃止**  
3. **スタンドアロン `/v2/student/form2` はリダイレクト（案 A）**  
4. **FormWorkspaceShell + focusMode（SideNav 非表示）+ 患者トップへ戻る**  
5. **Resizable 2 ペイン、比率は localStorage 共通キー、ダブルタップでリセット**  
6. **カルテ時右消失は flex min-content 膨張（仮説 B）。C5 で `min-w-0` / overflow 修正**  
7. **データ契約・Autosave・Conflict は触らない**  
8. **Form3 提出・本印刷は契約未実装のため Shell では無理に完成させない**  
9. **実装順は C2→C3→C5 を優先し、その後 C6–C8、Form3 は C9**  
10. **R3 Dialog 前に C5 を入れる**

---

## 変更予定ファイル（実装時・未着手）

| 領域 | 候補 |
| --- | --- |
| 新規 | `components/v2/workspace/FormWorkspaceShell.tsx`, `ResizableTwoPane.tsx` |
| Shell 接続 | `AppShell.tsx`, `LearningLayer.tsx`, `Form2Workspace.tsx`, `Form3PhaseBWorkspace.tsx` |
| 様式2 統合 | `Form2ReviewScreen.tsx`, `WorkspaceForm2Section.tsx`, `SideNav.tsx`（ラベル） |
| 印刷 CSS | `app/globals.css`（Form3 は将来） |
| ルート整理 | `app/v2/student/form2/page.tsx`（リダイレクト） |
| カルテ幅 | `WorkspacePatientReferencePane.tsx`, `CompassChart` 配下 / `ChartUi.tsx` |

---

## 参照

- `docs/version3/12_phase_b_ui_redesign.md`  
- `components/v2/form2-review/Form2ReviewScreen.tsx`  
- `components/v2/workspace/Form2Workspace.tsx`  
- `components/v2/form3/Form3PhaseBWorkspace.tsx`  
- `components/chart/ChartUi.tsx`（`min-w-[600px]`）  
- `app/globals.css`（`@media print`）  
- `lib/form3/v2/form3V2Validation.ts`（提出未実装注記）
