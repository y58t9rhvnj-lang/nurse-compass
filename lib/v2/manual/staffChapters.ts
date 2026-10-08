import type { ManualChapter, ManualOp, ManualShot } from "./types";

const op = (
  title: string,
  steps: { n: number; text: string }[],
  result?: string,
  shots: ManualShot[] = [],
): ManualOp => ({ title, shots, steps, result });

export const TEACHER_MANUAL_CHAPTERS: ManualChapter[] = [
  {
    id: "teacher-home",
    title: "教員ホーム",
    audience: "teacher",
    about: "ログイン後の起点です。いま置いてあるメニューだけを使います。",
    ops: [
      op(
        "各機能を開く",
        [
          { n: 1, text: "「お知らせを管理する」「提出課題・期限設定を開く」「提出・評価を開く」「Gold Standard を開く」「講義用学生画面を開く」「操作説明」から選びます。" },
        ],
        "成績の自動採点や順位付けは行いません。",
      ),
    ],
  },
  {
    id: "teacher-announcements",
    title: "お知らせの管理",
    audience: "teacher",
    about: "同じ組織の全学生向けにお知らせを下書き・公開・取り下げます。",
    ops: [
      op("下書き・公開・取り下げ", [
        { n: 1, text: "教員ホームの「お知らせを管理する」→「下書きを作成」で書きます。" },
        { n: 2, text: "「下書きを保存」のあと、学生に見せるときは「公開する」です。" },
        { n: 3, text: "止めるときは「取り下げる」です。再公開はできません。" },
      ]),
    ],
  },
  {
    id: "teacher-assessments",
    title: "提出課題・期限設定",
    audience: "teacher",
    about: "講義の進行に合わせて提出課題と期限を設定します。",
    ops: [
      op("期限を設定する", [
        { n: 1, text: "「提出課題・期限設定を開く」からグループとマイルストーンの期限を設定します。" },
      ], "受付が始まると、学生の「提出」に課題が出ます。"),
    ],
  },
  {
    id: "teacher-reviews",
    title: "提出・評価",
    audience: "teacher",
    about: "提出状況を確認し、評価を確定してから返却します。確定と返却は別です。",
    ops: [
      op("確定して返却する", [
        { n: 1, text: "「提出・評価を開く」で課題と学生を開きます。" },
        { n: 2, text: "「選択した評価を確定」します。この時点では学生には見えません。" },
        { n: 3, text: "見せるときは「学生へ一括返却」です。" },
      ]),
    ],
  },
  {
    id: "teacher-gold",
    title: "Gold Standard（読み取り専用）",
    audience: "teacher",
    about: "現時点で最も妥当な患者理解を読む画面です。完成答案の提示ではありません。",
    ops: [
      op("開いて読む", [
        { n: 1, text: "「Gold Standard を開く」から患者を選んで読みます。" },
      ]),
    ],
  },
  {
    id: "teacher-lecture",
    title: "講義用学生画面",
    audience: "teacher",
    about: "投影用に学生と同じ画面を開きます。内容は端末内のみです。",
    ops: [
      op("講義用画面を開く", [
        { n: 1, text: "「講義用学生画面を開く」を押します。ここで行った操作は学生データに保存されません。" },
      ]),
    ],
  },
];

export const ADMIN_MANUAL_CHAPTERS: ManualChapter[] = [
  {
    id: "admin-home",
    title: "管理者ホーム",
    audience: "admin",
    about: "お知らせ管理と学生管理が操作できます。",
    ops: [
      op("メニューを開く", [
        { n: 1, text: "「お知らせの管理」「学生管理」「学生を1名登録」「CSV一括登録」「操作説明」から選びます。" },
      ]),
    ],
  },
  {
    id: "admin-students",
    title: "学生管理",
    audience: "admin",
    about: "一覧確認、氏名修正、利用停止、パスワード初期化、個別登録、CSV一括登録ができます。",
    ops: [
      op("学生を管理する", [
        { n: 1, text: "「学生管理」で検索して学生を開きます。" },
        { n: 2, text: "「学生を1名登録」または「CSV一括登録」でアカウントを追加します。" },
      ]),
    ],
  },
];
