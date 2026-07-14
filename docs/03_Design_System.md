# Nurse Compass Design System

Version 1.0

---

# Design Philosophy

Nurse Compassは医療システムではあるが、
冷たい業務システムではない。

患者と学生の思考を支える
安心感のあるUIを目指す。

---

# Design Keywords

・Simple
・Warm
・Clinical
・Educational
・Calm
・Professional

---

# Color Rules

Primary
Blue

Action
Blue

Success
Green

Warning
Orange

Risk
Red

Background
Warm Gray

Card
White

---

# Border Radius

Card
16px

Button
12px

Patient Card
16px

---

# Shadow

Very Soft

医療システムらしい
落ち着いた影のみ使用する。

---

# Typography

見出し
Bold

本文
Regular

説明文
Small

---

# Icons

Line Icon

シンプルなアイコンのみ使用。

イラストを多用しない。

---

# Patient Colors

病室
Blue

デイルーム
Green

面談
Purple

外出
Orange

検査
Gray

---

# Ward Map Rule

病棟はリアルな間取りを再現する。

家具は簡略化する。

患者位置が一目で分かることを優先する。

---

# Compass Coach

濃紺背景

白文字

角丸カード

質問形式で表示する。

答えは表示しない。

---

# Animation

必要最小限。

教育を邪魔しない。

---

# Principle

迷ったら

シンプルな方を選ぶ。

派手さではなく

教育効果を優先する。

---

## iPad Safari対応

Next.js 16ではLAN経由(iPad実機)で開発サーバーへアクセスする場合、
next.config.ts の allowedDevOrigins にMacのLAN IPを追加する。

例

allowedDevOrigins: [
  "192.168.1.65"
]

設定変更後は

1. npm run dev を停止
2. rm -rf .next
3. npm run dev -- --hostname 0.0.0.0

で開発サーバーを再起動すること。

設定が無い場合、

・画面は表示される
・ボタンとして認識される
・Reactイベント(onClick)が動作しない

という現象が発生する。
