// Sprint8 Compass Patient 用のダミー拡張データ。
// 既存の PATIENTS（wardData）に無い項目（受け持ち日数・好きな食べ物・好きなこと・今日の様子）を補う。
// ※今回はダミーデータ。将来は電子カルテ／記録から取得する想定。

export interface CompassToday {
  summary: string; // 今日の様子（総評）
  sleep: string; // 睡眠
  meal: string; // 食事
  activity: string; // 活動
  expression: string; // 表情
}

export interface CompassExtra {
  caregivingDays: number; // 受け持ち日数
  favoriteFood: string; // 好きな食べ物
  likes: string; // 好きなこと
  today: CompassToday;
  coachPrompt: string; // Compass Coach の最初の問い
}

const DATA: Record<string, CompassExtra> = {
  A: {
    caregivingDays: 3,
    favoriteFood: "母のつくる肉じゃが",
    likes: "静かな場所で一人の時間を過ごすこと",
    coachPrompt: "最初にどんなことが気になりましたか？",
    today: {
      summary:
        "午前のOTには落ち着いて参加できた。人が増える午後は少し疲れた様子も見られた。",
      sleep: "22時就寝・6時起床。中途覚醒はなし。",
      meal: "朝・昼ともに8割摂取。食欲は戻りつつある。",
      activity: "OT（作業療法）に参加。集中して製本作業に取り組めた。",
      expression: "穏やか。会話中に笑顔が見られる場面もあった。",
    },
  },
  E: {
    caregivingDays: 5,
    favoriteFood: "旬の野菜を使った煮物",
    likes: "庭いじりや編み物など、手を動かすこと",
    coachPrompt: "最初にどんなことが気になりましたか？",
    today: {
      summary:
        "午前は臥床がちだったが、声かけでリハビリに参加できた。自責的な発言がやや聞かれた。",
      sleep: "早朝4時に覚醒。再入眠は難しかった。",
      meal: "朝食3割・昼食5割。「食べたい気持ちがわかない」との訴え。",
      activity: "リハビリに10分参加。途中で疲労を訴え臥床。",
      expression: "表情はやや硬い。うつむきがちで発語は少なめ。",
    },
  },
  F: {
    caregivingDays: 2,
    favoriteFood: "スパイスの効いたカレー",
    likes: "新しいアプリやガジェットを試すこと",
    coachPrompt: "最初にどんなことが気になりましたか？",
    today: {
      summary:
        "朝から多弁で活動的。SSTでは積極的に発言する一方、じっと座っているのは苦手な様子。",
      sleep: "就寝は1時、起床は5時。睡眠時間は短め。",
      meal: "3食とも全量摂取。食事の途中でも話し続ける。",
      activity: "SST・作業療法に参加。アイデアを多く出していた。",
      expression: "明るく高揚気味。声も大きく、身振りが多い。",
    },
  },
};

const FALLBACK: CompassExtra = {
  caregivingDays: 1,
  favoriteFood: "未入力",
  likes: "未入力",
  coachPrompt: "最初にどんなことが気になりましたか？",
  today: {
    summary: "未入力",
    sleep: "未入力",
    meal: "未入力",
    activity: "未入力",
    expression: "未入力",
  },
};

export function getCompassExtra(patientId: string): CompassExtra {
  return DATA[patientId] ?? FALLBACK;
}
