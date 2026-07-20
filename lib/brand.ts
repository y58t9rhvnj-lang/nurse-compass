// Nurse Compass ブランド定義（ロゴ・名称・タグライン・カラーパレットの単一の正）。
//
// ロゴ関連（サイドバー / ログイン / ヘッダー / メタデータ / ファビコン）は必ずここを参照し、
// 文言・配色を一箇所で統一する（ブランドガイド準拠）。個々の画面でロゴ文言や色をベタ書きしない。

export const BRAND = {
  // 正式名称（ワードマーク）。
  name: "Nurse Compass",
  // 英語タグライン（サブタイトル）。
  taglineEn: "Patient Understanding Learning System",
  // 提供元表記。
  poweredBy: "Powered by AIMS",
  // 日本語タグライン（理念文）。現状ログイン画面では非表示（将来の再利用のため定義は残す）。
  taglineJa: "患者理解は、1人の人生を統合的に理解しようとする継続的な過程です",
  // ブランドカラーパレット。
  colors: {
    navy: "#0D1B2A",
    blue: "#1E88E5",
    gray: "#9AA3AD",
    light: "#F2F4F7",
  },
} as const;

// ブラウザタブ等のタイトル（名称＋英語タグライン）。
export const BRAND_TITLE = `${BRAND.name} — ${BRAND.taglineEn}`;

// ロゴ素材レジストリ（public/brand 配下の共通素材）。
//
// 素材は共有ブランドシートから切り出した公式アートワーク（同一画像をコピーせず、ここを唯一の参照点にする）。
// intrinsic は各 PNG の実寸（px）。next/image に width/height を渡してアスペクト比を厳密に維持するため、
// 高さ指定（size）から幅を intrinsic 比で算出する。ロゴを CSS で片側だけ伸縮させない。
export type BrandLogoVariant =
  | "symbol"
  | "horizontal"
  | "vertical"
  | "monochrome";

export const BRAND_ASSETS: Record<
  BrandLogoVariant,
  { src: string; intrinsic: { width: number; height: number } }
> = {
  // シンボルマーク（コンパスローズ単体）。サイドバー・狭幅ヘッダー・ローディング等。
  symbol: {
    src: "/brand/nurse-compass-symbol.png",
    intrinsic: { width: 130, height: 136 },
  },
  // 横長ロゴ（シンボル＋ワードマーク＋英語サブタイトル）。ヘッダー用。
  horizontal: {
    src: "/brand/nurse-compass-logo-horizontal.png",
    intrinsic: { width: 300, height: 78 },
  },
  // フルロゴ（縦組み：シンボル＋ワードマーク＋サブタイトル＋Powered by AIMS）。ログイン用。
  // 正式版アートワーク（透過PNG）。背景を透過化しトリム済みの実寸。
  vertical: {
    src: "/brand/nurse-compass-logo-vertical.png",
    intrinsic: { width: 913, height: 673 },
  },
  // モノクロ版（印刷・白黒・淡色地用）。
  monochrome: {
    src: "/brand/nurse-compass-monochrome.png",
    intrinsic: { width: 232, height: 82 },
  },
} as const;
