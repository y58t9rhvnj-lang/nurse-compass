# 07. Evidence `sourceReference` 改善設計（案）

Version 1.0
Last Update: 2026-07-17
Status: Proposal（Sprint2 開始時に正式決定）

> 本書は TD-001（会話エントリIDのセッション跨ぎ衝突）への対応として、
> Evidence（Information Card）の出所参照 `source_reference` の識別子設計を見直す提案である。
> 正式方針により**会話全文の永続化は採用しない**前提で、Evidence 収集の一意性を維持する方式を比較・提案する。
> 実装は行わない。Sprint2 開始時にいずれかの方式を確定する。
>
> 関連: `docs/version2/06_sprint2_technical_debt.md`（TD-001）。

---

## 1. 現状と問題の再掲

- 会話エントリIDは位置ベースで決定的に採番される（`lib/patientFacingData.ts`：`id = \`${patientId}-${history.length}\``）。
- 会話状態 `FacingConvoState` はメモリ保持のみ。リロードで index が 0 から振り直され、`A-3` などのIDが**別発言に再利用**される。
- Evidence は `source_reference = {kind:"patient_conversation", id: entryId}` を**不変**（DBトリガー）で保持。
- サーバの一意制約 `uq_information_cards_source` は `(user_id, organization_id, academic_year, case_id, source_reference->>'kind', source_reference->>'id')`。
- クライアントは `isCollectedBySource(kind, id)` で収集済みを判定し、収集候補から除外する。

結果、別セッションで「同じ index に来た**別発言**」が偽って収集済み扱いになる／一意制約で拒否される（TD-001）。

一時メモ（`student_note`）は現状 `source_reference` を持たない（一意制約の対象外）ため、本課題は会話由来 Evidence が中心。

---

## 2. 新方式の要件

1. **偽の衝突を起こさない**：異なる事実は、セッションを跨いでも別 Evidence として収集できる。
2. **一意性を維持する**：同一事実の二重収集を適切に扱う（意図せぬ重複を防ぐ）。
3. **会話全文を永続化しない**：解決手段として会話ブロブ保存を用いない。
4. **既存DBと両立**：`source_reference` の `{kind, id}` 形状を維持し、**スキーマ変更なし**で `uq_information_cards_source`・immutable トリガーと両立する。
5. **クライアントを信用しすぎない**：識別子はサーバ側で検証・正規化できる形が望ましい（Phase 3-2 の「識別情報はサーバが決定」方針と整合）。

---

## 3. 比較する方式

### 方式A：セッションID + 発話連番
- `id = \`${sessionId}:${seq}\``（`sessionId` は会話を開くたびに発行する UUID、`seq` は当該会話内の発話連番）。
- セッション内で一意、セッション跨ぎでも別 `sessionId` になるため**偽衝突は起きない**。
- 同一事実を別セッションで再収集すると**別ID＝重複を許容**。
- トレーサビリティ（どのセッションの何番目か）が残る。

### 方式B：発話UUID（生成時に一度だけ付与）
- エントリ生成時に `crypto.randomUUID()` を割り当て、`id = <uuid>`。
- セッション内で一意 → **偽衝突は起きない**。
- ただし UUID は会話状態にのみ存在し、会話は永続化しないため、別セッションでは**新しい UUID** になり、同一事実の再収集は**別ID＝重複を許容**。
- 実質、方式A から「セッション/連番」の意味づけを外したもの。

### 方式C：content hash（原文由来）
- `id = hash(normalize(originalText))`（例：SHA-256 を短縮）。`kind="patient_conversation"`。
- **原文（学生が整える前の発話）**をハッシュ化するため、カード本文を後から修正しても identity は不変。
- 偽衝突が起きない（別発言＝別ハッシュ）うえ、**セッションを跨いでも同一発言は同一ID**になり、同一事実の二重収集を一意制約で防げる（要件1・2を同時に満たす）。
- 稀な副作用：患者がまったく同一の文言を複数回発話した場合、それらは同一 Evidence として扱われる（＝1件に集約）。架空・ルールベースの事例では許容範囲。
- サーバ側で原文から同じ手順でハッシュを再計算でき、**クライアントの id を信用せず検証/上書き**できる。

### 方式D：ハイブリッド（kind 別に方式を使い分け）
- `patient_conversation`：方式C（content hash）で事実単位の一意性を担保。
- `student_note`（一時メモ）：現状どおり `source_reference` なし（重複許容）か、必要なら content hash を任意付与。
- 将来の出所種別（記録直接収集など）は、その出所の安定キー（recordId 等）をそのまま `id` に使う。

---

## 4. 比較表

| 観点 | A: セッションID+連番 | B: 発話UUID | C: content hash | D: ハイブリッド |
|---|---|---|---|---|
| 偽衝突（TD-001）の解消 | ○ | ○ | ○ | ○ |
| セッション跨ぎの同一事実の重複防止 | ×（重複許容） | ×（重複許容） | ○ | ○（会話は C） |
| 同一文言の別発話の区別 | ○（別扱い） | ○（別扱い） | △（集約される） | △（会話は集約） |
| DBスキーマ変更 | 不要 | 不要 | 不要 | 不要 |
| immutable トリガー両立 | ○ | ○ | ○ | ○ |
| サーバ側での id 検証 | △（連番は状態依存） | △（クライアント生成） | ○（原文から再計算可） | ○ |
| トレーサビリティ | ○（セッション単位） | △ | △（内容単位） | ○/△ |
| 実装複雑度 | 低〜中 | 低 | 中（正規化・ハッシュ） | 中 |

---

## 5. 推奨（たたき台）

- **会話由来 Evidence には方式C（原文 content hash）を推奨**。
  - 理由：「Evidence は事実であり、正式な学習データ」という方針に対し、identity を**事実の内容そのもの**に紐づけるのが最も整合的。会話という揮発的インタラクションの位置やセッションに依存しない。要件1・2・3・4・5をすべて満たす。
  - `isCollectedBySource` と `getEntryId` は、収集時に「原文からハッシュを導出した id」を用いるよう変更（収集候補の判定も同じ導出で行う）。サーバ側 Server Action で原文からハッシュを再計算し、クライアント値を上書き（信用しない）。
- **一時メモ**は当面 `source_reference` なし（重複許容）を維持。将来、重複抑止が必要になれば content hash を任意付与（方式D）。
- 「同一文言の別発話を別 Evidence として残したい」要件が明確に出た場合のみ、方式A/B（セッションID or UUID）へ切り替える。現時点では優先しない。

最終決定は Sprint2 開始時に行う（本書は比較材料）。

---

## 6. 留意点・非対象

- 既存の一時メモ・会話由来カードの**移行は行わない**（Sprint1 は検証データのみで、正式データは未蓄積）。方式変更は Sprint2 以降の新規収集に適用する。
- `source_reference` は immutable（DBトリガー）を維持。id 導出方式を変えても `{kind, id}` 形状・一意制約・RLS は不変。
- 会話全文の永続化、エンジン状態の保存は**非対象**（正式方針）。
- 本方式変更は Evidence の収集・一意性のみに関わる。Form2・教員閲覧・Coach へは影響しない。

---

## 関連ドキュメント

- `docs/version2/06_sprint2_technical_debt.md` — TD-001 / TD-002 と Sprint2 方針
- `docs/version2/05_information_notebook.md` — Information Notebook（Evidence）設計
- `docs/version2/02_database.md` — `information_cards` スキーマ・一意制約・immutable トリガー
