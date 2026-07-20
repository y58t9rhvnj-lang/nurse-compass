import Image from "next/image";
import {
  BRAND,
  BRAND_ASSETS,
  type BrandLogoVariant,
} from "@/lib/brand";

// Nurse Compass 共通ロゴコンポーネント（Branding Integration / Sprint C）。
//
// 位置づけ:
//   ・ログイン / ヘッダー / サイドバー / ローディング等、Version2 全体のロゴ表示はこの 1 コンポーネントに集約する。
//     各画面へロゴ文言・画像パスをベタ書きしない（共有素材 public/brand を BRAND_ASSETS 経由で参照）。
//   ・素材は共有ブランドシートから切り出した公式アートワーク（ワードマーク書体を含む）。コードで描き直さない。
//
// 設計判断（型安全・過剰汎用化の回避）:
//   ・サブタイトル（Patient Understanding Learning System）と Powered by AIMS は、
//     vertical / horizontal のラスター素材に既に焼き込まれている。よって showSubtitle / showPoweredBy の
//     トグルは持たず、「どの variant を使うか」で表現する（symbol は文字なし・vertical は全部入り）。
//   ・size は表示「高さ(px)」。幅は intrinsic 比から算出して next/image に整数 px で渡す
//     （片側 auto による歪み・レイアウトシフト・警告を避け、アスペクト比を厳密維持する）。
//
// アクセシビリティ:
//   ・意味を持つロゴには alt（既定はブランド名）。装飾用途は alt="" を渡す（読み上げ対象外）。
//   ・意味はロゴ画像だけに依存させない（画面側で見出しテキスト等を併記する前提）。

const DEFAULT_HEIGHT: Record<BrandLogoVariant, number> = {
  symbol: 28,
  horizontal: 28,
  vertical: 120,
  monochrome: 28,
};

export default function NurseCompassLogo({
  variant = "horizontal",
  size,
  priority = false,
  className,
  alt = BRAND.name,
}: {
  variant?: BrandLogoVariant;
  // 表示する高さ(px)。幅は素材のアスペクト比から自動算出する。
  size?: number;
  // above-the-fold（ログイン・ヘッダー等）で LCP を早める場合に true。
  priority?: boolean;
  className?: string;
  // 装飾目的（隣に文字ロゴ/見出しがある）の場合は alt="" を渡す。
  alt?: string;
}) {
  const asset = BRAND_ASSETS[variant];
  const height = size ?? DEFAULT_HEIGHT[variant];
  // intrinsic 比で幅を算出（四捨五入）。アスペクト比を維持し、片側だけの伸縮を避ける。
  const width = Math.round(
    height * (asset.intrinsic.width / asset.intrinsic.height),
  );

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
