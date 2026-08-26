import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 開発時に iPad などが LAN 経由でアクセスする際のクロスオリジン許可（dev 専用）。
  // DHCP で端末IPが変わっても許可されるよう、代表的なプライベートサブネットの
  // ワイルドカードを登録する。ここに無いサブネットから dev サーバへアクセスすると、
  // Next.js dev が内部リソース(_next/RSC 等)へのクロスオリジン要求を拒否し、
  // ログイン後の画面遷移が失敗する（本番 `next start` には一切影響しない）。
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.1.*",
    "192.168.11.*",
    "10.0.0.*",
    "172.20.10.*",
  ],
  // 開発インジケータ（左上の "N" 等）は講義中の見た目を損なうため完全に非表示にする
  //（dev 専用の表示であり本番ビルドには元々出ない）。
  devIndicators: false,
};

export default nextConfig;
