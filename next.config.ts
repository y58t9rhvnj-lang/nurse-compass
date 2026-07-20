import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 開発時に iPad などが LAN 経由でアクセスする際のクロスオリジン許可（dev 専用）。
  // DHCP で端末IPが変わっても許可されるよう、現在のホストIPに加えサブネットの
  // ワイルドカードも登録する。本番ビルドには影響しない。
  allowedDevOrigins: [
    "localhost",
    "192.168.11.8",
    "192.168.11.9",
    "192.168.11.*",
  ],
  // 開発インジケータ（左上の "N" 等）は講義中の見た目を損なうため完全に非表示にする
  //（dev 専用の表示であり本番ビルドには元々出ない）。
  devIndicators: false,
};

export default nextConfig;
