# 08 Design Principles（Compass 設計原則）

Version 1.0
Last Update: 2026-07-12
Status: Official Version1 Design Principles（Version1 公式設計原則）

> 本書は Compass Version1 の公式設計原則、設計テスト、レビュー層を定義する。
> 上位思想は `docs/00_Compass_Charter.md`、教育モデルは
> `docs/06_Compass_Educational_Model_V1.md` を参照。

---

## 1. 設計原則（Design Principles）

1. **患者理解を最優先する。**
   （Patient understanding comes first.）

2. **事実と解釈は分離し続ける。**
   （Facts and interpretation must remain separate.）

3. **AI は思考を支えるが、決して肩代わりしない。**
   （AI supports thinking but never replaces it.）

4. **書く量を減らし、考える量を増やす。**
   （Reduce writing; increase thinking.）

5. **すべての考えは、根拠へたどれなければならない。**
   （Every thought must trace back to evidence.）

6. **様式は思考の結果であり、目的ではない。**
   （Forms are the result of thinking, not the goal.）

7. **学生の思考過程を保持する。**
   （Preserve the student's reasoning process.）

8. **自然に進行している思考を中断しない。**
   （Do not interrupt naturally progressing thinking.）

9. **「あれ？」の瞬間を支える。**
   （Support "あれ？" moments.）

10. **学生の選択が、システムの支援に先行する。**
    （Student choice precedes system assistance.）

11. **元の根拠（原文・出所）は不変である。**
    （Original evidence remains immutable.）

12. **一時メモ・収集データ・情報・手がかりを混同しない。**
    （Temporary memo, collected data, information and cue must not be conflated.）

13. **UI の用語は、看護学生・教員にとって自然でなければならない。**
    （UI terminology must be natural for nursing students and instructors.）

14. **教育上妥当な範囲で、最も単純な操作を優先する。**
    （The simplest educationally valid interaction should be preferred.）

15. **自動化は、思考ではなく転記を取り除く場合にのみ許される。**
    （Automation is allowed only when it removes transcription, not thinking.）

---

## 2. Design Test（設計テスト）

新しい機能は、次のすべてに答えられなければならない：

- 患者理解を深めるか？（Does it deepen patient understanding?）
- 意味のある思考を増やすか？（Does it increase meaningful thinking?）
- 転記や繰り返し入力を減らすか？（Does it reduce transcription or repeated input?）
- 根拠を保持するか？（Does it preserve evidence?）
- 事実と解釈を分離したままにするか？（Does it keep fact and interpretation separate?）
- AI が学生の判断を肩代わりするのを避けているか？（Does it avoid AI replacing student judgment?）
- 気づきを支えるか？（Does it support noticing?）
- 様式が思考から生まれることを可能にするか？（Does it allow forms to emerge from thinking?）
- 一時メモの役割を守るか？（Does it protect the temporary memo's role?）
- 実際の看護教育の言葉に合っているか？（Does it fit actual nursing-education language?）

**設計テストに合格しない機能は、Version1 では実装しない。**

---

## 3. Review Layers（2層のレビュー）

Compass Review は、次の2層で行う。

### 3.1 Implementation Review（実装レビュー）

- 正確性（correctness）
- バグ（bugs）
- 状態の永続化（state persistence）
- アクセシビリティ（accessibility）
- iPad での操作性（iPad usability）
- パフォーマンス（performance）

### 3.2 Educational Review（教育レビュー）

- 患者理解（patient understanding）
- 思考の質（thinking quality）
- 根拠のたどりやすさ（evidence traceability）
- 認知の中断（cognitive interruption）
- 不要な書き込み（unnecessary writing）
- Charter との整合（alignment with Charter）
- 「あれ？」が生じうるか（whether "あれ？" can emerge）

---

## 4. 関連ドキュメント

- `docs/00_Compass_Charter.md` — 憲章（§6 開発の6原則・§10 Compass Design Test）
- `docs/06_Compass_Educational_Model_V1.md` — 教育モデル（公式基盤）
- `docs/07_Glossary.md` — 用語集
- `docs/09_Design_Log.md` — 設計判断ログ

> 本書の設計原則と Charter（`docs/00`）は一致する。Charter を上位とし、
> 本書はそれを機能設計の判断へ具体化したものである。
