# AI Evaluation Import & Validation（Sprint 5B）

Status: **仕様固定（設計のみ）**  
親仕様: `03_ai_evaluation_staging_spec.md`  
結果契約: `schemas/ai-evaluation-result.schema.json`

---

## 1. 目的

手動アップロードされた AI 評価結果 JSON を検証し、staging 行を **`needs_review` または `invalid` のみ**で確定する。  
`imported` 状態は永続しない。自動採用は行わない。

---

## 2. 取込入口（初期）

| 項目 | 内容 |
|------|------|
| 方式 | teacher / admin による **手動 JSON ファイルアップロード** |
| 非対象 | API callback / webhook / プロバイダ直接書込 |
| 前提 | `evaluation_request_id` が requests 正本に存在し、**TTL 内で取込可能** |
| 禁止 | submission 手選択 |

### 2.1 request TTL と取込可否

| 条件 | 新規取込 |
|------|----------|
| `status = generated` かつ `now() < expires_at` | 可 |
| `status = used` かつ 同一 `evaluation_request_id` 未使用の再取込 | **不可**（request あたり staging 1回。`UNIQUE evaluation_request_id`） |
| `now() >= expires_at`（`generated`→`expired`） | **不可** |
| `status = expired` | **不可** |
| 別の新しい request（新 package） | 可（旧アクティブ staging は superseded） |

- TTL: **生成から90日**（`expires_at`）
- 期限後もレコードは **物理削除しない**
- **既に取り込まれた staging** の教員確認（ack / adopt / dismiss / 確認完了）は継続可能

### 2.2 取込シーケンス

1. アクター認証（teacher/admin）
2. JSON parse（失敗 → 行なし）
3. request 解決 + TTL / status 確認（期限切れ → 拒否）
4. 組織・提出一致
5. 正規化 → `result_hash` 計算（§7）
6. 重複検査: 同一 `evaluation_request_id`、同一 `(organization_id, result_hash)`
7. 検証パイプライン（§3）
8. 同一 `assessment_submission_id` のアクティブ行（`needs_review`\|`partially_adopted`）を **先に superseded**
9. staging INSERT（`needs_review` \| `invalid`）
10. 有効取込（`needs_review`）なら request を `used` + `used_at`
11. 監査: `import` + `validation`

---

## 3. Validation 分類

### 3.1 致命（→ `invalid`）

| コード（案） | 条件 |
|--------------|------|
| `json_parse_error` | 非 JSON |
| `schema_invalid` | result JSON Schema 不一致 |
| `unsupported_result_schema` / `unsupported_package_schema` | 未対応 schema |
| `evaluation_request_missing` / `mismatch` | request 不正 |
| `request_expired` | TTL 超過・`expired` |
| `submission_org_mismatch` | 組織不整合 |
| `duplicate_evaluation_request` | 同一 request の staging 既存 |
| `duplicate_result_hash` | 同一 org + `result_hash` |
| `rubric_structure_broken` | 未知 key、不正 score |
| `citation_invalid` | path も anonymous id も欠落 |
| `feedback_separation_broken` | draft / observation 欠落・混線 |
| `private_note_contaminated` | `private_note` キー混入 |
| `staging_hint_violation` | 契約違反 |

### 3.2 警告（→ `needs_review` + `validation_status=warning`）

採用には **警告単位の ack** がすべて揃うこと。自動採用禁止。

**version 系（`warning_family=version`）:**

| コード | 条件 |
|--------|------|
| `rubric_version_mismatch` | |
| `compass_policy_version_mismatch` | |
| `gold_standard_version_mismatch` | |
| `export_schema_version_mismatch` | |
| `case_version_mismatch` | |
| `incomplete_rubric_items` | 7 項目未満 |

**PII 系（`warning_family=pii`）:**

| コード | 強度 |
|--------|------|
| `pii_strong_email` / `phone` / `student_id` / `name_label` | 強 |
| `pii_weak_initials` 等 | 通常 |

version と PII は **UI・ack を別々に**行う（§4・§5）。

### 3.3 成功（`validation_status=ok`）

警告なし → ack 不要で adopt 可能（他条件は 05）。

---

## 4. Version 警告確認フロー

```
version_warnings[] を1件ずつ表示
  → 教員が各警告を確認し ack
       記録: warning_code, warning_payload_hash, acknowledged_by, acknowledged_at
       family = version
  → 監査 warning_ack（code + payload_hash）
```

ルール:

- 一括 boolean は使わない
- **未確認の version 警告が1件でもあれば adopt 不可**
- 再検証で payload が変わった場合、当該 code の旧 ack は無効（新しい `warning_payload_hash` が必要）
- ack は teacher のみ。採用そのものではない

---

## 5. PII 警告確認フロー

方針:

- 原則 warning。`private_note` 混入のみ invalid
- 強/通常を区別表示
- **family=pii として version とは別に確認**
- 未確認 PII 警告が1件でもあれば adopt 不可
- `raw_result_json` は学生非公開

payload_hash は検出箇所・マスク前抜粋の正規化などに基づき安定計算する（本文全文を監査に残さない）。

---

## 6. Schema・構造検証

必須セクションは result schema どおり。  
score: 1–5 または null。  
citations: `field_path` または `anonymous_object_id`。  
`private_note` キーはどこにあっても invalid。

---

## 7. `result_hash`（確定）

### 7.1 アルゴリズム

1. 取込 JSON から輸送メタデータを除き、評価内容を **normalize**（未知キー除去、文字列 trim、キー意味の正規化）し `normalized_result_json` とする  
2. `normalized_result_json` を **キー順固定**の canonical JSON 文字列にする（空白・キー順の揺れを吸収）  
3. その UTF-8 バイト列の **SHA-256 hex** を `result_hash` とする  

### 7.2 hash 対象 / 非対象

| 対象 | 含める |
|------|--------|
| `evaluation_request_id` | ○（評価の同一性の一部） |
| 評価本文（item_evaluations、feedback、observation、uncertainty 等） | ○ |
| versions（result metadata 内） | ○（normalized に含まれる範囲） |
| `imported_at` | × |
| HTTP ヘッダー | × |
| アップロードファイル名 | × |
| その他輸送メタデータ | × |

### 7.3 重複判定

- `UNIQUE (organization_id, result_hash)`  
- 同一 org で同一 hash → **取込拒否**（`duplicate_result_hash`）  
- raw の空白やキー順だけの違いは normalize + canonical により **同一結果**として扱う  

invalid でも、parse 可能な評価オブジェクトから normalized / hash を計算できる場合は staging に保存し重複検査する。parse 不能なら行を作らない。

---

## 8. 正規化

`normalized_result_json`:

- schema 外プロパティ除去
- trim
- rubric_key / citations 正規化
- 輸送メタデータ非保持

`validation_status=invalid` でも、可能なら normalized を残す（hash・監査用）。完全不能時のみ null（その場合 hash なし・行なし）。

---

## 9. アクティブ staging と Supersede

同一 `assessment_submission_id`:

- `needs_review` または `partially_adopted` は **原則1件**（partial unique index）
- 新しい有効 result 取込時: 旧アクティブを `superseded`（`superseded_by` 設定）→ 新行 INSERT
- `adopted` / `rejected` / `invalid` / `superseded` は履歴として残す
- 旧 adoption / warning_acks は削除しない

`adopted` を新取込で superseded するかは初期は **しない**（アクティブのみ置換）。必要なら将来拡張。

---

## 10. 採用前の警告充足条件

adopt 前にサーバーが検証:

1. `version_warnings` の各要素について、現行 `warning_payload_hash` と一致する ack が存在  
2. `pii_warnings` についても同様  
3. どちらか1件でも欠ければ adopt 拒否  

---

## 11. 監査（取込系）

| action | metadata |
|--------|----------|
| `import` | request_id, staging_id, result_hash, actor |
| `validation` | status, error/warning codes |
| `warning_ack` | family, code, payload_hash, actor |
| `supersede` | old/new staging_id |

本文全文は監査に保存しない。

---

## 12. エラーメッセージ方針

教員向け日本語。invalid は採用不可、warning は確認後に採用可を明示。TTL 超過は「評価リクエストの有効期限切れ」を明示。
