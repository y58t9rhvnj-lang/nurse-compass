# AI Evaluation Adoption Flow（Sprint 5B）

Status: **仕様固定（設計のみ）**  
親仕様: `03_ai_evaluation_staging_spec.md`  
検証: `04_ai_evaluation_import_validation.md`  
既存経路: `assessmentReviewWrite.ts` / `assessmentReviewRepository.ts`（draft + `baseUpdatedAt`）

---

## 1. 目的

staging 上の AI 評価候補を、教員が確認した範囲だけ既存 `assessment_reviews` **下書き**へ反映する。  
AI 原文は不変。採用のたびに `assessment_ai_evaluation_adoptions` へ追記し、履歴を上書きしない。

候補のクローズは **カバー率ではなく**、教員の「AI候補の確認を完了」で行う。

---

## 2. AI → review マッピング（確定）

| 入力 | 出力 | 条件 |
|------|------|------|
| 選択された `item_evaluations[].score` | `rubric_scores[key]` | 選択キーのみ |
| `strengths` | `strengths_comment` | ブロック選択時 |
| `next_questions` | `next_steps_comment` | 同上 |
| `gaps_or_alternatives` | `missing_information_comment` | 同上 |
| （なし） | `overall_comment` | **自動投入しない** |
| （なし） | `private_note` | **自動投入しない** |
| `teacher_observation` | （なし） | 閲覧のみ。手動反映は教員判断 |

未選択の教員既存入力は **維持**。  
`include_overall_comment` / `include_teacher_observation` は初期常に false（予約）。

---

## 3. 採用可能条件（必須すべて）

1. アクターが **teacher**（admin adopt は初期 OFF）
2. `review_status` ∈ { `needs_review`, `partially_adopted` }
3. `validation_status` ≠ `invalid`
4. version / PII の **未 ack 警告が0件**（警告単位・payload_hash 一致）
5. 対象 review:
   - 無ければ空 draft 作成可
   - **`status = draft`**
   - **現行返却中でない**
   - `completed` 不可（返却取消後も completed なら reopen 後のみ）
6. **optimistic locking**（`baseUpdatedAt`）
7. 今回の操作で採用または dismiss の対象が空でない

満たさなければ staging / review を変更しない。

---

## 4. Optimistic locking

既存 draft UPDATE と同一:

```
WHERE id = :review_id
  AND organization_id = :org
  AND updated_at = :baseUpdatedAt
  AND status = 'draft'
```

review を更新する adopt では、失敗時は adoption 行も作らず全体ロールバック。  
dismiss のみ（review 非更新）でも履歴行は追記してよい（before/after は同一 `updated_at`）。

---

## 5. 一部採用・dismiss・複数回採用

### 5.1 `adoption_selection_json` 例

```json
{
  "adopted_rubric_keys": ["information_gathering"],
  "adopted_comment_blocks": ["strengths"],
  "dismissed_rubric_keys": ["overall_integration"],
  "dismissed_comment_blocks": ["next_questions"],
  "include_overall_comment": false,
  "include_teacher_observation": false
}
```

- **adopted_***: 今回 review へ反映する項目  
- **dismissed_***: 今回採用しないと記録する項目（review は変更しない）  
- 未採用部分は後から追加 adopt 可能  
- 履歴行は上書きしない（`adoption_sequence` インクリメント）

### 5.2 状態（確認中）

| 状況 | `review_status` |
|------|-----------------|
| まだ一度も review へ反映していない | `needs_review` |
| 1回以上、採用（review 反映）を行った | `partially_adopted`（**教員確認中**） |
| 教員が「AI候補の確認を完了」し、採用履歴 ≥ 1 | `adopted` |
| 採用履歴 0 のまま却下 | `rejected`（`needs_review` からのみ） |

**採用率・カバー率では判定しない。**

### 5.3 状態遷移（採用まわり・確定）

| From | To | トリガ |
|------|-----|--------|
| `needs_review` | `partially_adopted` | review へ1項目以上 adopt |
| `needs_review` | `rejected` | 却下（採用履歴0） |
| `needs_review` | `superseded` | 新有効取込 |
| `partially_adopted` | `partially_adopted` | 追加 adopt / dismiss |
| `partially_adopted` | `adopted` | **AI候補の確認を完了**（採用履歴 ≥ 1） |
| `partially_adopted` | `superseded` | 新有効取込 |
| `partially_adopted` | `rejected` | **禁止** |

`needs_review` → `adopted` の直接遷移は禁止（確認完了は `partially_adopted` から）。

### 5.4 フロー

```
needs_review
  →（警告 ack 済）
  → adopt → partially_adopted（履歴 #1）
  → 追加 adopt / dismiss（#2…）
  → 「AI候補の確認を完了」→ adopted

needs_review
  → reject → rejected
  （一度も review に載せていない候補の破棄）
```

一度でも review へ反映した候補全体を「却下」と表現しない。未採用分は dismiss で記録し、確認完了で `adopted` とする。

---

## 6. 「AI候補の確認を完了」

Action 案: `completeAiEvaluationCandidateAction`（teacher のみ）

| 前提 | 結果 |
|------|------|
| `partially_adopted` かつ 当該 staging の adoption のうち **review 反映を伴う行が ≥ 1** | → `adopted`。`completed_at/by` 設定 |
| `needs_review` かつ採用履歴 0 | この Action では閉じない。**reject** を使う |
| `partially_adopted` なのに反映 adopt が0（dismiss のみ） | 実装は `partially_adopted` へ入らない設計とする。dismiss のみなら `needs_review` に留める |

**adopted / rejected は staging の終端。** `assessment_reviews` の completed / returned とは独立。

---

## 7. 却下（reject）

- teacher のみ
- **`needs_review` からのみ** → `rejected`
- `rejection_reason` 必須
- 既存 review は変更しない
- `partially_adopted` からの reject は **拒否**（エラー）
- 監査: `reject`
- 再オープンなし。再評価は新 request + 新取込

---

## 8. `teacher_observation` / `overall_comment`

| 項目 | 扱い |
|------|------|
| observation | 教員向け表示のみ。`private_note` 自動投入禁止 |
| overall | AI 自動投入禁止。教員が手書き |
| 学生返却 | observation を含めない |

---

## 9. UI 状態

| staging | 操作 |
|---------|------|
| `needs_review` | version ack と PII ack を**別セクション**で警告単位確認 → 採用 / 却下 |
| `partially_adopted` | 追加採用・dismiss・**確認完了**。却下ボタンなし（説明: 反映済みのため却下不可） |
| `adopted` | 履歴参照のみ |
| `rejected` / `invalid` / `superseded` | 参照のみ |

| review | AI 採用 |
|--------|---------|
| draft・未返却 | 条件満たせば可 |
| completed / 返却中 | 不可 |

学生 UI: AI 由来表示なし。staging / raw 非公開。

---

## 10. エラーケース（採用系）

| ケース | 結果 |
|--------|------|
| 未 ack 警告あり | adopt 拒否 |
| `partially_adopted` で reject | 拒否 |
| admin adopt / 確認完了 | 拒否 |
| completed / 返却中 | 拒否 |
| lock 失敗 | ロールバック |
| superseded に対する操作 | 拒否 |

---

## 11. 監査（採用系）

| action | 記録 |
|--------|------|
| `partial_adopt` | selection（adopted/dismissed キー）、sequence、hash |
| `dismiss` | dismissed キー（adopt と同一 Action なら partial_adopt に含めて可） |
| `complete_candidate` | staging_id → adopted |
| `reject` | reason（短文）、actor |

本文全文は監査に重複保存しない。スナップショット正本は adoptions 表。

---

## 12. 既存 `assessment_reviews` との接続

```
staging 候補
  → teacher adopt（選択分のみ draft へ）
  → adoptions 追記
  → teacher 確認完了 → staging adopted
  → 教員が既存 UI で complete / return（別ライフサイクル）
```

禁止: completed への直書き、AI return、overall/observation/private_note 自動投入、カバー率による自動クローズ、`partially_adopted` の「却下」。

---

## 13. Action 案（参考・未実装）

- `importAiEvaluationResultAction`（teacher/admin）
- `acknowledgeAiEvaluationWarningAction`（teacher・警告単位）
- `adoptAiEvaluationStagingAction`（teacher・adopt/dismiss）
- `completeAiEvaluationCandidateAction`（teacher）
- `rejectAiEvaluationStagingAction`（teacher・needs_review のみ）
- `getAiEvaluationStagingForSubmissionAction`（teacher/admin SELECT）

書込はすべて Server Action / SECURITY DEFINER。クライアント直接 UPDATE 禁止。
