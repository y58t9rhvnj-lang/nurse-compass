// Sprint A-2.1: 会話の自然さレイヤー（Version1）。
// 目的は臨床情報を増やすことではなく、自然な会話のやり取りを支えること。
// - あいづち（reflective acknowledgement）
// - 共感（empathy）への応答
// - 要約の確認 / やんわりした訂正
// - 小さな雑談（small-talk）
// - まれな逆質問（reciprocal question）
// ここには「患者A の話し方ルール（ペルソナ）」と、純粋な検出ヘルパーを集約する。
// 会話状態や話題キーワードに依存するロジックは patientFacingData 側に置く。

// 患者ごとの話し方（ペルソナ）。持たない患者は従来どおりの応答になる（E/F は影響なし）。
export interface PatientPersona {
  // あいづちライブラリ（控えめに・連続で同じものを使わない）。
  acks: string[];
  // 共感（つらい/大変 等）への短い受け止め・控えめな打ち消し・不確かさ。
  empathy: string[];
  // 話題語のない反射（「そうなんですね」等）への一般的なあいづち。
  genericReflection: string[];
  // 正確な要約への確認。
  summaryConfirm: string[];
  // 過度な一般化（毎日/全く 等）へのやんわりした訂正（話題別、"_" は汎用）。
  summaryCorrect: Record<string, string>;
  // 雑談（種別 → 応答候補）。
  smalltalk: Record<string, string[]>;
  // まれな逆質問（話題 → 一言）。
  reciprocal: Record<string, string>;
  // 話題の区切り・境界（話題 → 一言）。話したくない/覚えていない 等。
  boundary: Record<string, string>;
}

// 反射・共感を示す語尾マーカー（正規化済みテキストに対して判定）。
export const REFLECTIVE_MARKERS = [
  "んですね",
  "のですね",
  "なんですね",
  "だったんですね",
  "でしたね",
  "ましたね",
  "かったですね",
  "ですね",
  "ますね",
];

// 共感語（語幹で持ち、活用差を吸収する）。心配/不安 は anxiety 話題語のため含めない。
export const EMPATHY_STEMS = [
  "つら",
  "大変",
  "たいへん",
  "こわ",
  "怖",
  "寂し",
  "さみし",
  "しんど",
  "がんば",
  "頑張",
  "うれし",
  "嬉し",
  "大丈夫",
  "立派",
  "えらい",
];

// 過度な一般化を示す語（要約のやんわり訂正のトリガー）。
export const OVERGENERALIZATION_TOKENS = [
  "毎日",
  "毎晩",
  "毎回",
  "全く",
  "まったく",
  "全て",
  "すべて",
  "全部",
  "ぜんぶ",
  "ずっと",
  "いつも",
  "必ず",
  "一睡も",
  "常に",
  "絶対",
];

// 雑談の種別キーワード（話題語ではない・低stakes）。
export const SMALLTALK_KEYWORDS: Record<string, string[]> = {
  weather: ["暑い", "寒い", "天気", "雨", "晴れ", "蒸し", "涼し", "暖か"],
  tv: ["テレビ", "ドラマ", "ニュース"],
  placement: ["実習", "看護学生", "学生さん"],
};

// 患者A の応答に現れてはならない臨床分析用語（自然さ検証で使用）。
export const FORBIDDEN_CLINICAL_VOCAB = [
  "自己効力感",
  "社会的認知",
  "陰性症状",
  "陽性症状",
  "回復モデル",
  "アセスメント",
  "コーピング",
  "病識",
  "看護問題",
  "予後",
];

export function hasReflectiveMarker(norm: string): boolean {
  return REFLECTIVE_MARKERS.some((m) => norm.includes(m));
}

export function hasEmpathyWord(norm: string): boolean {
  return EMPATHY_STEMS.some((w) => norm.includes(w));
}

export function hasOvergeneralization(norm: string): boolean {
  return OVERGENERALIZATION_TOKENS.some((t) => norm.includes(t));
}

// 雑談の種別を返す（該当なしは null）。persona に応答が定義されている種別のみ。
export function detectSmalltalkKind(
  norm: string,
  persona: PatientPersona,
): string | null {
  for (const [kind, kws] of Object.entries(SMALLTALK_KEYWORDS)) {
    if (persona.smalltalk[kind] && kws.some((k) => norm.includes(k))) {
      return kind;
    }
  }
  return null;
}

// 安定した入力（seed）から決定的に一つ選ぶ。直前と同じもの（avoid）は避ける。
// ランダムを使わないため、自動テストが再現可能になる。
export function pickDeterministic(
  list: string[],
  seed: number,
  avoid?: string | null,
): string {
  if (list.length === 0) return "";
  let i = ((seed % list.length) + list.length) % list.length;
  if (avoid && list[i] === avoid && list.length > 1) {
    i = (i + 1) % list.length;
  }
  return list[i];
}

// 複数レイヤー（あいづち・本文・小さな継続）を、読みやすい改行で連結する。
// 空のレイヤーは無視する。UI 側は whitespace-pre-line で改行を表示する。
export function composeReply(layers: (string | null | undefined)[]): string {
  return layers
    .map((l) => (l ?? "").trim())
    .filter((l) => l !== "")
    .join("\n");
}

// 患者A の話し方（centralized persona）。
// 静かで控えめ・短い・ためらいがち・自信がない・自己卑下的・臨床分析はしない。
export const PATIENT_A_PERSONA: PatientPersona = {
  acks: [
    "そうですね……。",
    "はい……。",
    "そうかもしれません。",
    "うーん……。",
    "たぶん、そうだと思います。",
    "そうなんですかね……。",
    "あまり考えたことはないです。",
    "自信はないですけど……。",
  ],
  empathy: [
    "……そうですね。",
    "そんなに大したことでは、ないです。",
    "頑張っているかは、分からないですけど。",
    "少しずつ、です。",
    "……はい。",
  ],
  genericReflection: [
    "……そうですね。",
    "はい……。",
    "そうかもしれません。",
  ],
  summaryConfirm: [
    "はい……だいたい、そんな感じです。",
    "そうですね……、だいたい、そんな感じです。",
  ],
  summaryCorrect: {
    sleep: "声は毎日ではないですけど、眠れない時は、ラジオを聞いています。",
    hallucination:
      "声は、毎日ではないです。……夜に、気になることがある、という感じで。",
    _: "うーん……、いつもそう、というわけでは、ないんです。",
  },
  smalltalk: {
    weather: [
      "暑いですね……。中庭に行くなら、夕方の方がいいです。",
      "そうですね……。今日は、少し暑いですね。",
    ],
    tv: ["テレビは、あまり見ないです。夜は、ラジオのことが多くて。"],
    placement: ["……看護学生さん、ですか。ご苦労さまです。"],
  },
  reciprocal: {
    radio: "……そちらは、ラジオは聞きますか？",
    roommate: "Iさんのこと、知っているんですか？",
  },
  boundary: {
    mother: "母のことは、あまり……話していません。",
  },
};
