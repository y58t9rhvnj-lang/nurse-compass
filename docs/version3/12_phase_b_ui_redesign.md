# Compass Version3 — Phase B UI Redesign（設計レビュー）

- 文書種別: **設計レビュー**（実装承認前）
- 対象ブランチ: `feature/version2-form3`
- 作成日: 2026-08-18
- 前提: Information / Assessment / Final / Autosave / Reload / ローカル Flag 切替まで実装済み。iPad 実機で現行 UI を確認済み。
- 制約: 本文書承認前に大規模 UI 実装・コミット・push は行わない。

---

## 1. 現行 UI 構造

### 入口

`WorkspaceHost`（`form3` + `form3PhaseB` ON）→ `Form3PhaseBWorkspace`

### レイアウト（現行）

```
PC (lg+)
┌──────────────┬────────────────────────────┬──────────────┐
│ Patient      │ タブ: Information|Assessment│ Final 時のみ │
│ Source       │          |Final            │ Workspace    │
│ (要約リスト)  │ 常時展開カード一覧＋編集フォーム│ 参照パネル   │
└──────────────┴────────────────────────────┴──────────────┘

iPad / 狭幅
ヘッダ「Patient Source」Sheet / 「Workspace 参照」Sheet
中央は全幅タブ（Information / Assessment / Final）
```

### 主要コンポーネント

| 領域 | ファイル |
| --- | --- |
| Workspace | `components/v2/form3/Form3PhaseBWorkspace.tsx` |
| Information | `Form3InformationCardList` / `Form3InformationCardEditor` |
| Assessment | `Form3AssessmentCardList` / `Form3AssessmentCardEditor` |
| Final | `Form3FinalFormEditor` + `Form3FinalReferencePanel/Sheet` |
| Patient Source | `Form3PatientSourcePanel/Sheet` + `lib/form3/v2/form3V2PatientSource.ts` |
| Autosave | `hooks/v2/useForm3Supabase.ts` → `markUserEditedV2` |

### 思考ワークスペース（比較対象）

`Form2Workspace`（`clinical-workspace`）:

```
┌────────────────┬─────────────────┐  （右は Learning Inspector が sibling）
│ 電子カルテ|会話 │ 様式2（中央）    │
│ CompassChart   │                 │
│ WorkspaceConv  │                 │
└────────────────┴─────────────────┘
```

- 左ペインは **電子カルテ / 会話のみ**（常時 mount・CSS 切替でスクロール保持）
- **コンパスメモは左にない**（`LearningInspectorTabs` → `NoteZone`）
- カテゴリ・ページ送りは `CompassChart` / `ChartTabContent` 既存実装

---

## 2. 現行 UI と意図の相違

| # | 現行 | 意図する看護過程 |
| --- | --- | --- |
| 1 | Patient Source が要約専用。フル電子カルテ・会話・メモを思考 WS と同品質で見られない | カルテ・会話・メモを見ながら情報抽出 |
| 2 | Information / Assessment / Final が画面全体の主要タブ | ゴードン1パターン内で Info→Assess を進める |
| 3 | 11 Pattern の思考のまとまりが弱い（カードにタグ付けのみ） | 選択中 Pattern が主画面 |
| 4 | Information が常時展開 textarea | コンパクト一覧＋Dialog で作成・編集 |
| 5 | Assessment も常時直接入力 | 同上＋Evidence 先行 |
| 6 | 参照と編集が分離し、同一画面で進めにくい | 2ペイン同時参照・編集 |

教育上の目標フロー:

```
患者情報を読む
  → 選択中 Pattern について S/O Information を作る
  → 複数 Information を Evidence として選ぶ
  → Assessment を書く
  →（後段）Final Artifact
```

---

## 3. 新しい 2ペイン構造

### 推奨レイアウト（iPad 横・PC）

```
┌──────────────────────────┬──────────────────────────────┐
│ 電子カルテ｜会話｜メモ     │ ゴードン 11 Pattern タブ      │
│ （独立スクロール）         │ 選択中 Pattern 名             │
│ CompassChart / 会話 /     │ Information［＋情報を追加］   │
│ NoteZone（左タブ化）      │   コンパクトカード一覧         │
│                          │ Assessment［＋アセスメント］   │
│                          │   コンパクトカード一覧         │
└──────────────────────────┴──────────────────────────────┘
```

- 左右ペインは **独立スクロール**
- 主要ナビは **ゴードン Pattern タブ**（Information/Assessment/Final 全体タブは廃止）
- Patient Source 専用 UI は **主要参照にしない**（内部データ・コンポーネントは削除しない）

---

## 4. 左ペインの既存コンポーネント再利用案

### 再利用方針（推奨）

**`Form2Workspace` 左ペインを抽出して共有化する。**

新規候補名（仮）: `WorkspacePatientReferencePane`

| 要素 | 判定 | 根拠 |
| --- | --- | --- |
| `CompassChart`（embedded） | **そのまま再利用** | 分類・フィルタ・ページ送り済み |
| `WorkspaceConversation` | **そのまま再利用** | Core 会話 state 共有 |
| `NoteZone` / Notes Provider | **左ペイン第3タブとして接続** | 現状は Inspector 専用。二重実装せず props 経由で載せる |
| Form2 左の mount 維持 CSS 切替 | **共通化して再利用** | スクロール・タブ位置保持 |
| `Form3PatientSourcePanel` | **主要 UI から降格** | 要約・件数制限あり。モバイル要約フォールバック候補として残置可 |
| `buildForm3PatientSourceView` | **削除しない** | 内部活用・フォールバック可 |
| Phase B 専用カルテコピー | **禁止** | 二重実装しない |

### 注意

思考 WS 現行左は **メモタブが無い**。要件「電子カルテ｜会話｜コンパスメモ」を満たすには:

1. 共有ペインに `notes` タブを追加し `NoteZone` を載せる（推奨）
2. または Form3 時のみ Learning Inspector を開く（2ペイン意図と衝突しやすい）

→ **1 を推奨**。

### Props（想定）

```
patient, facingState, onChangeFacingState,
（Notes は既存 NotesProvider コンテキストを利用）
```

---

## 5. ゴードン 11 Pattern ナビゲーション

### 並び（学校指定順）

1. 健康知覚・健康管理  
2. 栄養・代謝  
3. 排泄  
4. 活動・運動  
5. 睡眠・休息  
6. 認知・知覚  
7. 自己知覚・自己概念  
8. 役割・関係  
9. 性・生殖  
10. コーピング・ストレス耐性  
11. 価値・信念  

（コード上の `Form3PatternKey` / `form3PatternShortLabel` と対応）

### 表示ルール

- **一度に編集するのは 1 Pattern のみ**
- 選択中を視覚的に明示（背景・下線・件数バッジ）
- 右ペイン内容は選択 Pattern の Information / Assessment にフィルタ

### デバイス別案

| 環境 | 推奨 | 代替 |
| --- | --- | --- |
| iPad 横 / PC | 横スクロールタブ（短縮ラベル） | 2段チップ（密集時のみ） |
| iPad 縦 | 横スクロールタブ＋「パターンを選ぶ」Sheet | ドロップダウン |
| Split View 狭幅 | Sheet 選択を既定 | タブは補助 |

旧 `Form3PatternNav`（v1 Form3）は見た目参考にできるが、Phase B は新コンポーネントが妥当。

---

## 6. Information Card 作成フロー

### 表示

- 初期: **コンパクト一覧のみ**（常時 textarea 禁止）
- 「＋ 情報を追加」→ Dialog / Sheet でフォーム

### 入力項目（UI）

| 項目 | 扱い |
| --- | --- |
| S / O | **必須** |
| 情報内容 | **必須** |
| sourceType / sourceLabel / sourceReference | **UI から外す**（既存フィールドはデータ契約維持。未入力 or 既定値） |
| observedAt / recordedAt | **UI から外す** |

### フロー

1. 「情報を追加」
2. S または O
3. 内容入力
4. 「作成」
5. 一覧にコンパクトカード追加 → Autosave

作成先 Pattern = **現在選択中 Pattern**（単一所属として扱う）。

---

## 7. Information Card 編集・削除

### 編集

- カード本体タップ or「編集」→ 作成と同じ Dialog
- 編集可: S/O・内容
- **同一 ID を更新**（新規作成しない）

### 削除（学生向け文言）

- UI 表示は **「削除」のみ**（「Archive」非表示）
- 確認: 「この情報カードを削除しますか？［キャンセル］［削除］」
- 内部: 既存 `archiveForm3InformationCard`（soft delete）維持
- 復元: 短時間 Undo **または** 「削除済みを表示」＋「戻す」（既存 unarchive）

詳細は §13（Evidence 使用中）。

---

## 8. Information Card 移動

### UX

「移動」→ 移動先 Pattern 選択 Dialog/Sheet

### データ

| 項目 | 扱い |
| --- | --- |
| カード ID | **維持** |
| S/O・内容 | 維持 |
| Evidence 参照 | **壊れない**（ID 不変） |
| 表示 | 元 Pattern から消え、先 Pattern に出る |
| 同一 Pattern 選択 | no-op |

### 実装

新規 ops 例: `moveForm3InformationCardToPattern(data, cardId, patternKey)`  
（既存の上下 reorder `moveForm3InformationCard` とは別。命名衝突に注意）

Autosave reason 候補: `information_updated`（最小）または `information_moved`（追跡性）

---

## 9. Information Card コピー

### UX

「コピー」→ コピー先 Pattern 選択（1回1 Pattern）

### データ

| 項目 | 扱い |
| --- | --- |
| 元カード | 残る |
| 新カード | **新 ID** |
| S/O・内容 | 複製 |
| Evidence | **コピーしない**（Assess は元 ID のまま） |
| 編集・削除 | 独立 |

新規 ops 例: `copyForm3InformationCardToPattern(data, cardId, patternKey)`  
Autosave reason 候補: `information_added` または `information_copied`

---

## 10. 単一 Pattern 所属と既存 `patternKeys[]` の整合

### 現行契約（`docs/version3/04_information_model.md`）

- `patternKeys[]` は **タグ（0..N）** であり所有ではない
- UI 現行も「パターン（複数可）」

### 新 UI 意図

- 基本は **1 Card = 1 Pattern 所属**
- 他 Pattern で使う場合は学生が明示 **コピー**

### 推奨（データ破壊なし）

1. **スキーマの `patternKeys: Form3PatternKey[]` は維持**（破壊しない）
2. 新規作成・移動・コピー後の正規形: **`patternKeys` 長さ 0 または 1**
3. UI フィルタ: `patternKeys.includes(selected)` または（移行互換）`length===0` の扱いを明示
4. **既存の複数タグデータ**:
   - **勝手に分割・削除しない**
   - 表示案: 該当する全 Pattern に同じカードを表示し、バッジ「複数パターン」＋「コピーで分離できます」程度の案内
   - または primary = `patternKeys[0]` にのみ一覧表示し、他キーは詳細に表示（要 UX 決定）

### primary pattern の要否

- 当面 **不要**（配列長 1 を所属とみなす）
- 将来フィールド追加するなら別 Phase

### 進捗ロジック注意

現行 `form3V2Progress` は `patternKeys.length === 0` を全 Pattern にカウントする挙動あり。単一所属 UI では **空タグを禁止**（作成時に必ず現在 Pattern を入れる）ことを推奨。

---

## 11. Assessment 作成フロー

### 表示

- コンパクト一覧
- 「＋ アセスメントを作成」→ Dialog/Sheet

### 順序（必須）

```
Evidence 選択
  → 選択中情報の確認
  → アセスメント本文
  →（任意）Need More Information
  →（任意）Classification
  → 保存
```

- 作成時の所属 Pattern = **現在選択中 Pattern**（`patternKey` 単一・既存契約と一致）
- 本文を Information からコピー保存しない（既存どおり ID 参照）

---

## 12. Evidence 選択方法

### 基本

- Dialog 先頭にチェックリスト
- **既定は現在 Pattern の Information（active）のみ**
- 複数選択可
- 「選択中の情報 N件」をフォーム内に再掲（S/O＋本文プレビュー）

### 拡張（Should）

- ［他のパターンの情報も表示］で全 Pattern 展開（コスト注意・折りたたみ必須）

### データ

- `evidenceInformationIds: string[]` のみ更新
- 既存 `updateForm3AssessmentCard` / sanitize の unknown ID drop を維持

---

## 13. Evidence 使用中 Information 削除の方針

### 比較

| 案 | 内容 | 長所 | 短所 |
| --- | --- | --- | --- |
| **A** | 警告のうえ削除可。参照の扱いを明示 | 柔軟 | 学生が参照切れを見落とす |
| **B** | 使用中は削除不可。先に Evidence から外す案内 | 参照壊れにくい・分かりやすい | 一手増える |

### 推奨: **案 B（MVP）**

1. 削除時に `assessmentCards`（active）の `evidenceInformationIds` を走査
2. ヒットしたら Dialog:  
   「この情報はアセスメントの根拠として使われています。先にアセスメントの編集で根拠から外してください。」  
   ［閉じる］のみ（削除不可）
3. 使用中でなければ確認後 archive

案 A は「強制削除＋Assess 側で ID を自動除去」を後続 Should とするなら実装可能だが、教育 UI では B が安全。

現行 sanitize は archived evidence を警告しつつ ID 保持。案 B 採用後も互換は保たれる。

---

## 14. Assessment 編集・削除

### 編集

- 「編集」→ 作成と同じ Dialog
- 可: Evidence / 本文 / Need More / Classification
- ID 維持

### 削除

- UI「削除」＋確認
- 内部 archive（→ `archived`、復元時は既存どおり `draft`）
- Undo または削除済み表示は Information と揃える

---

## 15. Final 配置案 A/B

| | 案 A | 案 B（優先候補） |
| --- | --- | --- |
| 配置 | 各 Pattern 内 Info→Assess→Final | Info/Assess 完了後、別「様式表示・提出」 |
| 利点 | 1 Pattern 完結 | 思考と Artifact 分離・WS 単純・様式2との統合余地 |
| 欠点 | Pattern 画面が長い・Core/Artifact 混在 | 導線が一段増える |

### 推奨: **案 B**

- Final は Clinical Reasoning **Core ではない Artifact**（`07_artifact_model` / Principles と一致）
- 現行 `Form3FinalFormEditor` は残し、ナビを「様式3提出 / Final」等の **二次導線**へ移す
- 承認前に Final の大きな実装変更はしない（R7）

---

## 16. iPad 横向き

- **常時 2ペイン**（左参照＋右 Pattern WS）
- 患者情報を毎回 Sheet で開かせない（実機横向き幅を前提）
- Pattern は横スクロールタブ
- 左右独立スクロール
- タップ領域 ≥ 44px

---

## 17. iPad 縦向き

- 右（Pattern WS）を主画面
- 左は開閉 or「患者情報」→ Sheet（中身は同一 `WorkspacePatientReferencePane`）
- Pattern: 横スクロールタブ＋選択 Sheet
- 日本語キーボード: Dialog 内スクロール・`visualViewport` / `scrollIntoView` を考慮（実装 Phase）

---

## 18. Split View

| 幅 | 挙動 |
| --- | --- |
| 十分（概ね `lg` 相当） | 2ペイン |
| 狭い | 患者情報 Sheet 化・Pattern Sheet |
| ブレークポイント | 既存 `lg` / `xl` と整合（Form2 左幅 300–380、Phase B 現行 Sheet 閾値） |

要件チェックリスト: 横はみ出し禁止、Sheet 内スクロール、二重 Sheet 競合回避（同時1枚）、アドレスバー伸縮耐性、回転後再レイアウト、連続タップ二重追加防止（作成中 disable）、日本語変換中の壊れた Autosave 防止（composition イベント考慮）。

---

## 19. 再利用可能な既存コンポーネント

| コンポーネント | 判定 |
| --- | --- |
| `CompassChart` | 再利用 |
| `WorkspaceConversation` | 再利用 |
| `NoteZone` + NotesProvider | 左タブとして再利用 |
| Form2 左ペイン構造 | **抽出して共通化** |
| `ConfirmDialog` | 削除確認に再利用可 |
| Phase B Sheets パターン | Dialog/Sheet 骨格の参考 |
| `useForm3Supabase` / Autosave Controller | **維持・作り直さない** |
| Information/Assessment ops（add/update/archive） | 拡張して利用 |
| `Form3PatientSource*` | 主要 UI から降格・削除しない |
| `Form3FinalFormEditor` | Final 二次画面で再利用 |
| `Form3InformationCardEditor`（現行常時展開） | **置き換え対象** |
| `Form3AssessmentCardEditor`（現行常時展開） | **置き換え対象** |
| I/A/F 全体タブ | **廃止候補（ナビから）** |

---

## 20. 新規作成・変更・廃止候補コンポーネント

### 新規（仮名）

| 名前 | 役割 |
| --- | --- |
| `WorkspacePatientReferencePane` | 共有左ペイン（chart/conversation/notes） |
| `Form3PatternTabBar` | 11 Pattern ナビ |
| `Form3PatternWorkspace` | 選択 Pattern の Info+Assess 領域 |
| `Form3InformationCompactCard` | 一覧カード |
| `Form3InformationEditorDialog` | 作成・編集（S/O＋内容のみ） |
| `Form3InformationMoveDialog` | 移動先 Pattern |
| `Form3InformationCopyDialog` | コピー先 Pattern |
| `Form3AssessmentCompactCard` | 一覧カード |
| `Form3AssessmentEditorDialog` | Evidence→本文→任意項目 |
| `Form3FinalArtifactScreen`（R7） | 案 B の Final 入口 |

### 変更

- `Form3PhaseBWorkspace` — 2ペイン＋Pattern ナビへ再構成
- `Form2Workspace` — 左を共有ペイン呼び出しに置換（任意・同一見た目維持）
- `form3V2InformationOps` — move-to-pattern / copy / UI 用フィルタ
- `form3V2AutosaveReasons` — 必要なら moved/copied
- Labels — 「削除」統一、Archive 語の排除

### 廃止候補（ナビ・主要表示から）

- Information/Assessment/Final **全体タブ**
- Patient Source を主左ペインとする構成
- 常時展開 Editor を一覧に埋め込む UX

コードファイル自体の即削除はしない（ロールバック・参照用）。

---

## 21. データモデルへの影響

| 項目 | 要否 |
| --- | --- |
| `schemaVersion: 2` | **変更なし** |
| `informationCards` / `assessmentCards` / `finalForm` | **維持** |
| `evidenceInformationIds` | **維持（ID 参照）** |
| `patternKeys[]` | **スキーマ維持**。運用を単一所属寄りに |
| `Assessment.patternKey` | **維持**（既に単一） |
| source* フィールド | **スキーマ維持**。UI 非表示可 |
| 新規必須カラム | **不要**（MVP） |
| 既存複数タグデータの自動分割 | **禁止** |

---

## 22. Autosave への影響

| 項目 | 方針 |
| --- | --- |
| Controller / Save Gate / Action | **作り直さない・仕様変更しない** |
| 経路 | すべて `markUserEditedV2(next, reason)` |
| 作成・編集・削除 | 既存 reasons で足りる |
| 移動・コピー | `information_updated` / `information_added` で開始可。専用 reason は任意 |
| Dialog 保存ボタン | ローカル state → 確定時にのみ mark（入力中の無駄 save を減らす） |
| 日本語 IME | `compositionstart/end` 中は patch 抑制を検討（R9） |
| Conflict / Save failed UI | 本 Redesign の必須ではないが、RC 既知 Must は別途残る |

---

## 23. 実装フェーズ案

| Phase | 内容 | 依存 | 主な変更 |
| --- | --- | --- | --- |
| **R1** | 左ペインを思考 WS と共通化（chart/会話/メモ） | なし | 抽出コンポーネント、`Form3PhaseBWorkspace` / 任意で Form2 |
| **R2** | ゴードン Pattern ナビ＋単一 Pattern フィルタ表示 | R1 推奨 | TabBar、一覧フィルタ |
| **R3** | Information コンパクト＋Dialog 作成・編集（S/O＋内容） | R2 | 新 Dialog、Editor 置換 |
| **R4** | Information 削除確認・移動・コピー | R3 | ops 追加、Dialog |
| **R5** | Assessment Dialog（Evidence 先行） | R2–R3 | 新 Dialog |
| **R6** | Assessment 削除＋Evidence 使用中 Info 削除ポリシー B | R5 | ガード UI |
| **R7** | Final を二次 Artifact 画面へ（案 B） | R2 | ナビ変更。Editor 再利用 |
| **R8** | iPad 縦・横・Split 最適化 | R1–R5 | ブレークポイント、Sheet |
| **R9** | Autosave / Reload / Conflict 回帰 | 全体後 | 検証スクリプト＋実機 |

各 Phase は Feature Flag `form3PhaseB` 配下で出し分け可能。旧 Phase B UI をしばらく残す場合は内部サブフラグも検討（任意）。

---

## 24. リスク

| リスク | 影響 | 緩和 |
| --- | --- | --- |
| `patternKeys[]` タグ契約と単一所属 UI の乖離 | 既存データ表示の混乱 | スキーマ非破壊＋複数タグ互換表示 |
| 左ペイン共通化で Form2 回帰 | 様式2学習が壊れる | 抽出後に Form2 見た目不変テスト |
| Evidence 全 Pattern 展開 | パフォーマンス | 既定は現 Pattern のみ |
| Dialog＋キーボードで入力隠れ | iPad UX | R8 で visualViewport |
| Final 導線喪失 | 提出漏れ | R7 で明示入口 |
| 連続タップ二重作成 | データ増殖 | 作成中ボタン disable |
| 用語「削除」vs soft delete | 教員・学生の期待差 | 確認文と復元導線 |
| Conflict UI 未配線（既知） | 保存停止の誤認 | 別 Must Fix として残置 |

---

## 25. 推奨案（総括）

1. **2ペイン**: 左＝思考 WS と同系の患者参照（共通抽出）、右＝選択 Pattern の Info→Assess  
2. **ナビ**: ゴードン 11 Pattern。I/A/F 全体タブは主要ナビから外す  
3. **Information**: コンパクト一覧＋Dialog。入力は S/O＋内容のみ  
4. **移動 / コピー**: 明示操作。ID 維持（移動）／新 ID（コピー）。Evidence はコピーしない  
5. **`patternKeys[]`**: スキーマ維持、新規は単一。既存複数は非破壊互換表示  
6. **Assessment**: Evidence 先行 Dialog。ID 参照維持  
7. **Evidence 使用中削除**: **案 B（削除不可＋案内）**  
8. **Final**: **案 B（二次 Artifact 画面）**。承認前は大きな実装変更なし  
9. **Autosave / schemaVersion / Save Action**: 維持  
10. **Patient Source**: 削除せず、主 UI から降格  

---

## 参照

- `docs/version3/04_information_model.md`（patternKeys タグ契約）
- `docs/version3/05_assessment_model.md`
- `docs/version3/07_artifact_model.md`
- `docs/version3/09_clinical_reasoning_principles.md`
- `docs/version3/10_version3_rc_review.md`（既知 Must/Should）
- `docs/version2/13_ui_architecture.md`（Form2 3カラム）
- 実装: `Form2Workspace.tsx`, `Form3PhaseBWorkspace.tsx`, `lib/form3/v2/*`

---

## 改訂メモ

- 初版: 設計レビュー。実装・コミットなし。
