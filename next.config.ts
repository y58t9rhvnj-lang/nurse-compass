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
};

export default nextConfig;
