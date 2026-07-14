# Nurse Compass — Compass Version1

看護学生向けの **患者理解トレーニング教材** です。学生は架空の受け持ち患者
「Aさん」と面接し、電子カルテを読み解きながら、患者を多面的に理解する思考プロセスを
体験します。

> **重要**
> 本アプリは看護教育用の教材です。実在患者の電子カルテではなく、医療行為・診断・
> 治療を目的としたシステムでもありません。登場する患者・職員・医療機関はすべて架空です。

---

## Compass Version1 の目的

- 「患者を病名ではなく“人”として理解する」入り口を体験する
- 患者との面接（患者会話）とカルテ情報を往復しながら考える力を養う
- Compass Coach の問いかけを通じて、気づき・疑問を言語化する

## Version1 の対象機能

- 受け持ち患者 **Patient A**
- 患者会話（Version1）
- Compass Coach（Version1）
- 電子カルテ
  - 診療録（医師記録・SOAP、看護記録の参照表示を含む）
  - 看護記録（記録／看護計画／看護サマリー）
  - 医療サマリー
  - 処方・検査・指示
  - フローシート
  - 文書フォルダ（PDFビューア風表示）
    - 入院診療計画書
    - 転倒・転落アセスメントシート
    - 褥瘡リスクアセスメントシート
    - 栄養スクリーニング・アセスメントシート
- 気づきメモ
- Version1 講義導線
- 固定タブ（Stickyタブ）

### Version2 機能は含みません

情報整理ノート（Clinical Thinking Workspace）や収集ワークフローなどの未完成機能は、
`lib/featureFlags.ts` のフラグで学生画面から**非表示**にしています（コード・データは保持）。
本リリースに Version2 機能は含まれません。

---

## 技術構成

| 項目 | 内容 |
| --- | --- |
| フレームワーク | Next.js `16.2.10`（App Router） |
| UI | React `19.2.4` / React DOM `19.2.4` |
| スタイル | Tailwind CSS v4 |
| アイコン | lucide-react |
| 言語 | TypeScript |
| パッケージマネージャー | npm（`package-lock.json` を使用） |
| データ保存 | クライアント内（React state ＋ localStorage）。サーバー・DB・外部APIなし |
| 認証 | なし |
| 外部API | なし |

### 必要な Node.js バージョン

- **Node.js 20 以上（LTS）推奨**（`@types/node` は v20 系）
- Next.js 16 は Node.js 18.18 以上を要求します。Vercel では Node.js 20.x を推奨します。

---

## インストール

```bash
npm install
```

## ローカル起動（開発）

```bash
npm run dev
```

`http://localhost:3000` を開きます。

## 本番ビルド／起動

```bash
npm run build   # 本番ビルド
npm run start   # 本番モードで起動（既定は :3000。PORT=3100 npm run start で変更可）
```

## 静的チェック

```bash
npx tsc --noEmit   # 型チェック
npm run lint       # ESLint
```

## データ整合性の検証スクリプト（任意・開発者向け）

`scripts/` 配下に症例・記録の整合性検証スクリプトがあります（本番配信物には含まれません）。

```bash
npx tsx scripts/validate-patient-a.ts
npx tsx scripts/validate-nursing-records.ts
npx tsx scripts/validate-physician-records.ts
npx tsx scripts/validate-clinical-timeline.ts
# ほか scripts/ 参照
```

---

## 環境変数

**本番動作に必須の環境変数はありません。**
本アプリは DB・外部API・認証・APIキーを使用しない、クライアント完結型の静的アプリです。

- 雛形: [`.env.example`](./.env.example)
- 実際の秘密情報を含む `.env` / `.env.local` は `.gitignore` で Git 管理外です
  （`.env.example` のみ追跡対象）。

---

## データ保存方式（学生データ）

学生がブラウザで入力・操作した内容は、**その端末のブラウザ内にのみ**保存されます。
サーバーや他の学生とは共有されません。

| データ | 保存先 | localStorage キー |
| --- | --- | --- |
| 患者会話履歴（Compass Coach の状態を含む） | localStorage | `compass:v1:patient-conversation:<患者ID>` |
| 気づきメモ | localStorage | `nc:notes:<患者ID>` |
| 課題シートの既読状態 | localStorage | `compass:firstAssignment:<患者ID>` |
| 情報カード（V2・非表示） | localStorage | `nc:information-cards` |
| 情報整理（V2・非表示） | localStorage | `nc:organized-information` |
| 画面遷移・下書き等の一時状態 | React state（更新で消える） | — |

患者会話は、同じ端末・同じブラウザでページを再読み込み・再訪問すると復元されます
（バージョン付きで保存し、壊れた/旧形式データは安全に初期状態へ戻します）。
Compass Coach は会話状態から表示が導出されるため、専用の保存領域は持ちません。

### 学生データの初期化方法

現時点で画面上の「初期化」ボタンはありません（大規模な新機能は今回追加しません）。
端末内の Version1 データを初期状態へ戻すには、次のいずれかを行います。

1. ブラウザの「サイトデータを削除」（推奨・確実）
   - 該当サイトの Cookie とサイトデータ（localStorage を含む）を削除する
2. ブラウザの開発者ツール Console で、Compass のキーのみ削除:

```js
Object.keys(localStorage)
  .filter((k) => k.startsWith("nc:") || k.startsWith("compass:"))
  .forEach((k) => localStorage.removeItem(k));
location.reload();
```

> 共有端末（実習室のPC・iPad等）では、授業終了後に上記のいずれかで
> データを消去してください（学生向け利用案内も参照）。

---

## Vercel への公開方法

本プロジェクトは追加設定なしで Vercel に公開できます。

1. GitHub リポジトリを Vercel にインポート（Framework は自動で **Next.js** を検出）
2. 設定はデフォルトのままで可
   - Build Command: `next build`（自動）
   - Install Command: `npm install`（自動）
   - Output: Next.js 標準（`.next`。`output` ディレクトリの手動指定は不要）
   - Node.js Version: **20.x** を推奨（Project Settings → General）
   - 環境変数: **設定不要**
3. Deploy を実行

詳細な公開前手順は [`docs/VERSION1_RELEASE_CHECKLIST.md`](./docs/VERSION1_RELEASE_CHECKLIST.md) を参照してください。

---

## 公開前チェック（要点）

- `npm run build` が成功する
- `npx tsc --noEmit` / `npm run lint` がエラーなし
- 秘密情報がコードに含まれていない（環境変数・APIキーなし）
- Patient A を含む全データが架空である
- PC / iPad で主要画面が表示・操作できる
- 直接URLで存在しないページを開いても、日本語の 404 画面になる

チェックリスト全文: [`docs/VERSION1_RELEASE_CHECKLIST.md`](./docs/VERSION1_RELEASE_CHECKLIST.md)

## 既知の制限

- **対応端末は PC と iPad（横／縦）**。固定幅の左右パネルを用いるため、
  スマートフォンなど狭い画面では左右パネルが画面幅を占有し、中央の内容が
  見切れます（横スクロールは発生しません）。
- 文書フォルダの4帳票は実PDFではなく、A4帳票を HTML で忠実に再現した
  「PDFビューア風」表示です（`public` 配下に実PDFは置いていません）。
- データはブラウザ内保存のため、別端末・別ブラウザ間で引き継がれません。

## Patient A について

Patient A（Aさん）を含む患者・家族・職員・医療機関（Aims Medical Center）・
患者ID・日付・処方・検査値等はすべて**架空**です。実在の個人・施設とは関係ありません。

## 本教材の位置づけ

- 看護教育用の教材です。
- 実在患者の電子カルテではありません。
- 医療行為・診断・治療を目的としたシステムではありません。
