# VERSION2_ACCEPTANCE_CRITERIA — 受け入れ条件（案）

> ステータス: **設計案**。機能確定後に各項目を最終化する。
> Version2 の各機能は「flag off で Version1 と完全等価」を満たして初めてマージ可能とする。

## 1. 学習目的を満たす条件

- [ ] 学生が収集した情報を、**自分で** 分類・関連づけできる（アプリが自動でやらない）。
- [ ] 学生が患者の全体像を **自分の言葉** で記述できる（テンプレ穴埋め/自動生成に依存しない）。
- [ ] 情報カードから **出所（面接発言・カルテ記載）へ必ず戻れる**（根拠確認）。
- [ ] Compass Coach が答えでなく **問い返し** で伴走する（整理段階でも）。
- [ ] 全体像から **看護上の課題・次の問い** へ、学生自身がつなげられる。
- [ ] Version1 の「面接で情報を集め、カルテと結ぶ」学習が損なわれない。

## 2. UI 要件

- [ ] 追加 UI は feature flag on 時のみ表示。off 時は V1 と同一。
- [ ] 面接 / カルテ / 整理ノートの行き来で迷子にならない（現在地が分かる）。
- [ ] 収集・分類・関連づけの操作が、思考を代行しない範囲で明確。
- [ ] タップ標的は 44px 以上（`docs/adr/001-iPad-Safari-Tap-Issue.md` 順守）。
- [ ] 破壊的操作（削除等）は取り消し可能 or 確認あり。
- [ ] 空状態（カード0件など）に適切なガイドがある。

## 3. 保存要件

- [ ] すべての学習データは `localStorage` に保存され、再訪時に復元される。
- [ ] 患者ごとにデータが分離され、**他患者と混在しない**。
- [ ] 保存データは `version` を持ち、壊れた/旧形式は **安全に初期化**（クラッシュしない）。
- [ ] `try/catch` で parse を保護。容量超過・プライベートモードで画面が落ちない。
- [ ] 初期レンダリングで空データが既存データを上書きしない。
- [ ] SSR / Hydration 不整合が出ない（`useSyncExternalStore` + `getServerSnapshot`）。
- [ ] 既存 localStorage キー（`nc:notes:*` / `nc:information-cards` / `nc:organized-information` / `compass:v1:*`）を破壊・改称しない。

## 4. iPad 要件

- [ ] iPad Safari（横向き）で収集・分類・関連づけ・言語化が一通り完了できる。
- [ ] タップ・スクロール・テキスト入力が破綻しない。
- [ ] （D&D を採用する場合）iPad Safari で確実に動作する。動作不安定なら選択式へ切替。
- [ ] Coach パネルが縦/横で適切に配置される。
- [ ] 保存・復元が iPad Safari / Chrome / デスクトップ Safari で確認済み。

## 5. Version1 回帰防止（必須ゲート）

- [ ] `lib/featureFlags.ts` の既定値は変更しない（すべて off）。
- [ ] flag off のとき、Version1 と **バイト等価**の学生導線・表示になる。
- [ ] `npm run build` が成功する。
- [ ] `tsc --noEmit` エラー0 / `eslint` エラー0。
- [ ] 既存の検証スクリプトがすべて成功する
      （patient-a / nursing-records / physician-records / clinical-timeline /
       conversation-naturalness / coach-behavior / coach-examples / documents / lecture-readiness ほか）。
- [ ] Version1 の患者会話・Coach 応答・看護記録・診療録・4帳票・処方・検査・指示が不変。
- [ ] 本番 URL・本番デプロイに影響しない（feature branch / preview のみ）。

## 6. Version2 機能の完了条件（機能ごと）

各機能（Epic/Task）は次を満たしたとき「完了」とする。

- [ ] 対応する学習段階（①〜⑥のいずれか）を支援できている。
- [ ] flag off 等価性テスト（T-901）を通過。
- [ ] iPad 実機確認（T-902）を通過。
- [ ] 保存・復元・患者分離・不正データ耐性を確認。
- [ ] 「思考を代行していない」ことをレビューで確認（教育方針チェック）。
- [ ] ドキュメント（該当 docs/version2）の該当項目を確定へ更新。

## 7. リリース判断（Version2 → 本番の前提）

- [ ] 上記 1〜6 をすべて満たす。
- [ ] 講義フィードバックで確定した仕様に沿っている。
- [ ] 教員が学習効果を確認済み。
- [ ] Version1 からの移行で既存ユーザーデータが壊れない（version/normalize 検証）。

> 本書の各チェックは **案**。機能確定時に「保留」を外し、確定条件へ更新する。
