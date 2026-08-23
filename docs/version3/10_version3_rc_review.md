# Compass Version3 — Release Candidate Review（Phase B7）

- 文書種別: **RC 品質レビュー**（機能追加なし）
- 対象ブランチ: `feature/version2-form3`
- 対象 HEAD（レビュー時点）: `fc111c3`（B6 Final Form）含む Phase B 一式
- レビュー日: 2026-08-18
- 方法: Student Journey / UX / Autosave / Performance / Accessibility / Code を実装コードと検証スクリプトから確認（新機能は追加しない）
- Feature Flag: `FEATURE_FLAGS.form3PhaseB` **default `false`**（旧 Form3 へロールバック可能）

---

## 0. レビュー範囲と前提

Version3 MVP（様式3 Phase B）として実装済みの範囲:

| 領域 | 状態 |
| --- | --- |
| Patient Source 参照 | 完了（B5） |
| Information Card | 完了（B3） |
| Assessment Card | 完了（B4） |
| Final Form（Artifact） | 完了（B6） |
| Autosave / Save Gate / Migration | 完了（B1–B2-2C2） |
| Clinical Reasoning Principles | 文書完了（`09`） |

本 RC は「学生が **1症例を Patient Source → Information → Assessment → Final まで最後まで進められるか**」を品質観点で判定する。Coach / AI / Related Map / Evidence 拡張 / Patient 編集は対象外（未実装のままで講義 DoD 上も許容）。

---

## 1. Student Journey Review

想定導線（学生視点）:

```
Patient Source を読む
  → Information を追加・編集（事実）
  → Assessment を追加・編集（解釈・Evidence・Classification）
  → Final に学校様式を自分の言葉で書く
  → Autosave で Saved
```

### 1.1 できたこと

- タブ（Information / Assessment / Final）で段階を切り替えられる。
- PC では左に Patient Source、中央に作業、Final 時は右（xl）に Workspace 参照。
- iPad / 狭い画面では Patient Source・Workspace 参照が Sheet。
- Final 参照は転記しない（設計どおり Artifact 分離）。
- Evidence は Information ID 参照のみ（コピー禁止）。

### 1.2 つまずきやすい点

| 箇所 | 観察 |
| --- | --- |
| 初期画面 | Flag OFF だと旧 Form3 のまま。V3 体験には Flag ON が必須（運用手順が必要） |
| Assessment | Evidence 候補が全 Information 一覧のため、カードが増えると選択が重い |
| Final | 11 Pattern を縦に並べるため、長いスクロールになる（教育上は許容だが疲労あり） |
| 戻る | ブラウザ戻るではなくタブ切替が主。タブ間でスクロール位置は保持されない |
| 削除 | UI 表記は「削除」だが実体は Archive（論理削除）。誤解の余地あり |

---

## 2. UX Review

### 確認項目と結果

| 項目 | 判定 | メモ |
| --- | --- | --- |
| 迷う操作 | △ | 全体導線は明確。Conflict / 保存失敗時の次アクションが UI に出ない |
| Information 追加 | ○ | 「＋ Information」＋空状態 CTA |
| Assessment 追加 | ○ | 「＋ Assessment」＋空状態 CTA |
| Final への遷移 | ○ | タブ「Final」 |
| 戻る操作 | △ | タブで戻れるが、スクロール位置・フォーカスはリセットされやすい |
| 保存状態表示 | △ | Ready / Draft / Saving / Saved / Save failed はある。**Conflict が Draft に見える** |
| iPad 操作 | ○〜△ | Sheet・min 44px は概ね良好。Patient Source と Final 参照の二重 Sheet は注意 |
| スクロール | ○〜△ | ペイン独立スクロールあり。大量カード時は未最適化 |
| タップ領域 | ○ | 主要ボタンは `min-h-[44px]` 中心 |

### 良かった点（UX）

- Apple HIG 寄りの余白・階層で「1カード＝1事実／1解釈」が伝わる。
- Final に自動転記導線がない（教育原則と一致）。
- Patient Source / Workspace 参照が「参照のみ」と明示されている。

---

## 3. Autosave Review

### 状態遷移（実装）

| 状態 | 実装 | Phase B UI |
| --- | --- | --- |
| Ready | `hasPersistedV2=false` かつ未 dirty | 表示あり |
| Draft | dirty / saveStatus dirty | 表示あり |
| Saving | saveStatus saving | 表示あり |
| Saved | persisted かつ clean | 表示あり |
| Save failed | saveStatus error | **ラベルのみ**（再試行ボタンなし） |
| Conflict | Hook / Gate で停止 | **専用表示なし**（多くは Draft に見える） |
| Migration のみ | hasUserEdited=false → schedule しない | 意図どおり（保存されない） |

### 判定

- 正常系 Ready → Draft → Saving → Saved は Controller + Hook 接続済みで成立。
- **異常系（Conflict / Save failed）の回復 UI が Phase B Workspace に未接続**なのが RC の最大ギャップ。
- v1 `Form3Header` には conflict / retry があるが、Phase B は独自ヘッダのため未継承。

---

## 4. Performance Review

想定負荷: Information 50 / Assessment 30 / Final 11 Pattern。

| 観点 | 観察 | リスク |
| --- | --- | --- |
| リスト仮想化 | なし（全カード DOM） | 中〜高 |
| Evidence UI | Assessment ごと × Information 全件 checkbox | **高**（例: 30×50 の操作ノード） |
| Final | 11 Pattern × 2 textarea | 低〜中（許容） |
| Autosave | debounce 1s・単一 payload | 中（JSON 肥大は講義規模では概ね可） |
| Patient Source | 記録件数に上限あり（例: 看護/診療 各12） | 低 |

講義でカードが急増しなければ致命ではないが、**Evidence 選択の全件展開は Should Fix 以上**。

---

## 5. Accessibility Review

| 項目 | 判定 | メモ |
| --- | --- | --- |
| キーボード操作 | △ | 基本は可能。タブ UI が `role="tablist"` 未整備 |
| フォーカス | △ | Sheet は初期フォーカスあり。タブ切替後のフォーカス移動は弱い |
| タブ順 | △ | 長い Classification / Pattern チップ列でタブキー周回が長い |
| 読みやすさ | ○ | 16px 入力・余白十分 |
| 余白 | ○ | カード間ギャップ大きめ |
| ライブリージョン | △ | 保存状態に `aria-live` がない（旧 Header にはあった） |
| 削除/Archive | △ | 文言と実操作の不一致 |

---

## 6. Code Review

### 良かった点

- Core ops（Information / Assessment / Final）が純関数で Hook と分離。
- AutosaveReason で操作種別を追跡。
- Save Gate / Migration 非 dirty の契約が検証スクリプトで守られている。
- Phase B 検証スクリプト（B1–B6）が揃っている。

### 改善点（コード）

| 項目 | 内容 |
| --- | --- |
| 未使用 | `Form3PhaseBPlaceholder` が入口から外れ未使用（削除せず残置はロールバック用として可） |
| コメント陳腐化 | `form3PhaseBLabels.ts` に「Autosave 未接続」と残っている（実態は接続済） |
| 重複 | Sheet（Patient Source / Final Reference）の開閉・Escape 処理が類似 |
| Workspace 肥大 | `Form3PhaseBWorkspace` がハンドラ集中（可読性 Should） |
| Conflict UI | Hook API（`conflictSnapshotV2` / `loadLatestOnConflict`）があるのに UI 未配線 |
| TODO | Phase B 新規 UI に TODO/FIXME は見当たらず |

---

## 7. 良かった点（総括）

1. **教育導線が Core → Artifact の順**になっている（Principles / Artifact Model と一致）。
2. Information / Assessment / Final / Patient Source の役割境界が UI 上も明確。
3. Autosave 正常系と Migration 非保存が実装・検証されている。
4. Flag OFF で旧 Form3 に戻せるため、講義リスクを抑えやすい。
5. 自動転記・AI・Related Map を入れずに様式3まで成立する骨格がある。

---

## 8. 改善点（総括）

1. Conflict / Save failed の**学生向け回復導線**不足。
2. 大量 Evidence 候補の**選択 UI 負荷**。
3. 保存状態の Conflict 可視性・a11y（aria-live / tab roles）。
4. 移行後バナー等の**安心フィードバック**不足。
5. 「削除」＝Archive の用語整理。

---

## 9. Must Fix（講義投入前に必須）

| ID | 内容 | 理由 |
| --- | --- | --- |
| M1 | **Conflict UI** を Phase B に接続（状態表示＋「最新を読み込む」等） | 競合時に Draft と区別できず、保存が止まり続けると症例完走が壊れる |
| M2 | **Save failed 時の再試行** UI（または明示的 flush） | ラベルだけでは学生が次の一手を取れない |
| M3 | **Flag ON の投入手順**を確定（対象 org / テストアカウント / ロールバック担当） | default false のままでは学生が V3 に到達しない。手順なき本番化は不可 |

> 注: M3 はコード変更ではなく運用 Must。コード Must は M1 / M2。

---

## 10. Should Fix（できれば講義前）

| ID | 内容 |
| --- | --- |
| S1 | Evidence 選択の軽量化（折りたたみ・フィルタ・仮想化・選択済み優先） |
| S2 | 保存状態に Conflict 専用ラベル（Draft と分離）＋ `aria-live` |
| S3 | タブに `role="tablist"` / `aria-selected`、切替時フォーカス方針 |
| S4 | 「削除」→「アーカイブ」等、論理削除の用語統一 |
| S5 | v1→v2 Migration 後の軽い案内（データは残っている／編集すると保存される） |
| S6 | タブ間スクロール位置の簡易保持 |
| S7 | `form3PhaseBLabels` の「Autosave 未接続」コメント修正 |
| S8 | iPad Safari 実機スモーク（キーボード表示時の入力欄隠れ・Sheet 二重） |

---

## 11. Nice to Have

| ID | 内容 |
| --- | --- |
| N1 | Final Pattern のジャンプナビ（11 Pattern の目次） |
| N2 | Information / Assessment 件数バッジ |
| N3 | Sheet 開閉ロジックの共通化 |
| N4 | Workspace ハンドラ分割（可読性） |
| N5 | Placeholder のドキュメント化または開発専用導線整理 |
| N6 | 大量カード向けの簡易ベンチ（50/30）を検証スクリプト化 |

---

## 12. 講義投入可否

### 判定

**条件付き可（Conditional Go）**

- **限定パイロット**（少人数・Flag ON・監督付き）なら、Must Fix（M1–M3）対応後に投入可能。
- **学年一斉・監督なし**は、M1/M2 未対応のままでは非推奨（Conflict / 保存失敗で症例が止まるリスク）。

### DoD（`11_form3_phase_b_implementation_plan.md` §13）との照合

| # | DoD | RC 時点 |
| --- | --- | --- |
| 1 | Patient Source 参照 | ○ |
| 2 | Information 複数 | ○ |
| 3 | Assessment 複数 | ○ |
| 4 | 複数 Evidence | ○ |
| 5 | Classification 併存 | ○ |
| 6 | Final 自己記述 | ○ |
| 7 | Autosave・復元 | △（正常系○ / 異常系 UI△） |
| 8 | v1 移行損失なし | ○（エンジン）／案内 UI△ |
| 9 | iPad 致命停止なし | △（コード上は配慮あり・実機確認 Should） |
| 10 | Flag ロールバック | ○ |
| 11 | build/tsc/eslint/検証 | ○（各 Phase スクリプト） |
| 12 | AI・関連図なしで成立 | ○ |

### 推奨次アクション（機能追加なし）

1. M1 / M2 を最小 UI で接続（新機能ではなく既存 Hook API の配線）。  
2. M3 の投入・ロールバック手順を教員向けに1枚化する。  
3. S8 の iPad 実機スモーク後、パイロット開始。  
4. パイロット後に S1（Evidence 負荷）を優先改善。

---

## 13. 参照コミット（主要）

| Phase | Commit（要約） |
| --- | --- |
| B0–B2 | Flag / schema / persistence / read / write / autosave engine |
| B2-2C2 | `51d9292` Autosave Activation |
| B3 | `d9a15d6` Information Card UI |
| B5 | `c1ac8b3` Patient Source |
| Principles | `04f0231` Clinical Reasoning Principles |
| B4 | `c179710` Assessment Card UI |
| B6 | `fc111c3` Final Form Artifact UI |

---

## 改訂メモ

- 初版: Phase B7 RC レビュー。機能追加なし。講義投入は Conditional Go。
