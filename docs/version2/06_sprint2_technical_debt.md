# 06. Sprint2 Technical Debt（技術的負債ログ）

Version 1.0
Last Update: 2026-07-17
Status: Recorded（実装前・Sprint2 で対応）

> 本書は、Sprint1（Patient Workspace 統合）完了時点で判明した設計・実装上の技術的負債を、
> 将来の保守で経緯が追えるように記録するものである。
> Sprint1 のレビューで承認された正式方針（会話全文は永続化しない／Evidence を正学習データとする）を前提とする。
> 実装は行わず、対応方針と優先順位のみを確定する。
>
> 関連: 中央設計ログ `docs/09_Design_Log.md`（DL-013）、
> `docs/version2/07_evidence_source_reference.md`（sourceReference 改善設計）。

各エントリの形式：

- **ID**
- **区分 / 深刻度 / Sprint2 優先度**
- **症状（Symptom）**
- **根本原因（Root cause）**
- **影響（Impact）**
- **対応方針（Direction）**
- **やらないこと（Non-goals）**
- **検証観点（Validation）**
- **参照（References）**

---

## TD-001：会話エントリIDのセッション跨ぎ衝突（Evidence 収集の一意性）

- **区分**：データ整合性 / **深刻度**：中 / **Sprint2 優先度**：② sourceReference 設計見直し
- **症状**：会話から収集した Evidence の出所参照（`source_reference.id`）が、ページ再読み込み後の別セッションで**別の発言に再割り当てされ得る**。その結果、
  - (a) 2回目のセッションで「同じ index に来た**別の**患者発言」が収集候補から除外される（`isCollectedBySource` が誤って一致）、
  - (b) 収集を試みてもサーバの一意制約 `uq_information_cards_source`（`user_id, organization_id, academic_year, case_id, kind, id`）が重複として拒否する、
  という**偽の衝突（false collision）**が起こる。
- **根本原因**：
  1. 会話エントリIDが**位置ベースで決定的**に採番される（`lib/patientFacingData.ts`：`history.push({ ...entry, id: \`${patientId}-${history.length}\` })`）。
  2. 会話状態 `FacingConvoState` は**メモリ保持のみ**でリロードで初期化されるため、次セッションでは index が 0 から振り直され、`A-3` 等のIDが**別の発言に再利用**される。
  3. Evidence 側は `source_reference = {kind:"patient_conversation", id: entryId}` を不変（DBトリガーで immutable）として保持し、上記の再利用IDと突き合わせるため衝突する。
- **影響**：学生が2回目以降のセッションで一部の発言を収集できない／重複エラーになる。データ破壊は起きないが、収集体験の正確性を損なう。頻度は「同一 index に別発言が来たとき」に限られるが、会話は自由入力のため十分起こり得る。
- **対応方針**：**会話全文の永続化では解決しない（正式方針で不採用）**。`source_reference` の識別子設計を、位置非依存の方式へ見直す（発話UUID／セッションID＋連番／content hash 等を比較検討）。詳細と比較・推奨案は `docs/version2/07_evidence_source_reference.md` を参照。Sprint2 開始時に方式を正式決定する。
- **やらないこと**：`conversation_sessions` 等による会話ブロブ保存。エンジン状態の永続化。
- **検証観点**：別セッションで異なる発言が正しく収集候補に出るか／同一事実の二重収集が適切に扱われるか／既存の immutable トリガー・一意制約と両立するか（スキーマ変更を伴わないこと）。
- **参照**：`lib/patientFacingData.ts`（`getEntryId` / エントリ採番 / `FacingConvoState`）、`hooks/v2/useEvidenceSupabase.ts`（`isCollectedBySource`）、`supabase/migrations/0006_information_cards.sql`（`uq_information_cards_source` / immutable トリガー）、`docs/version2/07_evidence_source_reference.md`。

---

## TD-002：Server Action 例外の未ハンドル（working / saving 固定）

- **区分**：エラーハンドリング / **深刻度**：高 / **Sprint2 優先度**：① 例外処理共通化（最優先）
- **症状**：Evidence（`useEvidenceSupabase`）と Form2（`useForm2Supabase`）のいずれも、Server Action 呼び出しを **try/catch なし**で `await` している。Action が**エラー結果（`res.ok===false`）を返す**場合は既存の分岐で `error`/`conflict` に落ちるが、**Action 呼び出し自体が例外を throw する**場合（通信断でサーバへ到達不可、認証失効でのリダイレクト応答 等）は分岐に到達しない。
  - Evidence：`setStatus("working")` の直後で中断し、**`working` のまま固定**（ボタン disabled のまま）。
  - Form2：`await saveForm2Action(...)` が throw すると直後の `inFlightRef.current = false` に到達せず、**`inFlightRef` が true・`saving` のまま固定**（以降の保存がブロックされる）。
- **根本原因**：`await` を保護していないため、reject 時に状態遷移・フラグ解除の後続処理が実行されない。
- **影響**：入力内容自体は失われない（成功時のみクリア／Form2 は下書き退避あり）が、UI が保存不能状態に固定され、ユーザーが復帰できない。講義中の一時的な通信不調で発生し得るため深刻度は高い。
- **対応方針**：Evidence・Form2 の Server Action 呼び出しを**共通の例外処理方針へ統一**する。要件：
  1. **try/catch** で Action 呼び出しを包む。
  2. throw 時に **inFlight フラグ解除**（Form2）／進行中フラグ解除（Evidence）。
  3. **status を `error` へ更新**（`working`/`saving` に留めない）。
  4. **エラーメッセージ表示**（原因の生情報は出さない）。
  5. **リトライ可能**にする（Evidence は手動再試行で十分）。
- **やらないこと**：Form2 専用の下書き保存・自動再試行を Evidence へそのまま移植すること（Evidence は短文入力のため手動再試行で十分）。DBの生エラー文言のクライアント露出。
- **検証観点**：通信断を模した状況で `working`/`saving` に固定されないこと／`error` 表示と再試行で復帰できること／StrictMode 下で多重発火・無限保存が起きないこと／入力が保持されること。
- **参照**：`hooks/v2/useEvidenceSupabase.ts`（`collectUtterance` / `collectMemo` / `updateContent` / `release`）、`hooks/v2/useForm2Supabase.ts`（`doSave`：`inFlightRef` 解除位置）。

---

## Sprint2 正式方針（2026-07-17 承認）

Sprint1 レビューで確定した方針を記録する（実装は Sprint2）。

1. **会話履歴の永続化**：実装しない。Sprint2 でも会話全文の Supabase 保存は行わない。会話は学習インタラクションであり、**Evidence が正式な学習データ**。構造は「会話 → Evidence 収集 → Evidence のみ永続化」を維持する。
2. **エントリID問題（TD-001）**：優先度を上げて対応。ただし**会話全文保存では解決しない**。`source_reference` の設計見直しで対応（`07_evidence_source_reference.md`）。
3. **未ハンドル例外（TD-002）**：Sprint2 **最優先**。Evidence・Form2 を共通の例外処理方針へ統一（try/catch・inFlight 解除・status 更新・エラー表示・リトライ）。
4. **Form2 との共通化**：Server Action 呼び出し／エラー処理／状態管理を可能な範囲で共通化する。ただし Form2 専用の下書き保存・自動再試行は Evidence へ移植しない（Evidence は手動再試行で十分）。
5. **Compass Coach**：現行設計を維持。Coach は Question／Reflection／Evidence を**読んでよい**が、Question・Reflection・Patient Story・Evidence を**書くことは絶対に禁止**。Coach は「問い・方向づけ・気づき」のみを返す。
6. **Sprint2 優先順位**：
   1. ① Exception Handling 共通化（TD-002）
   2. ② Evidence `sourceReference` 設計見直し（TD-001）
   3. ③ Question
   4. ④ Reflection
   5. ⑤ Story Workspace
   6. ⑥ Patient Story
   - Story Workspace より**基盤品質を優先**する。

---

## 関連ドキュメント

- `docs/09_Design_Log.md` — 中央設計ログ（DL-013 に本負債・方針の要約を記録）
- `docs/version2/07_evidence_source_reference.md` — Evidence `sourceReference` 改善設計
- `docs/version2/01_architecture.md` — V2 アーキテクチャ
- `docs/version2/05_information_notebook.md` — Information Notebook 設計
