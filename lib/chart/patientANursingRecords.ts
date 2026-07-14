// 患者A 看護記録（SOAP / POS・フォーカス / 時系列ナラティブの使い分け）。
import type { ClinicalRecord, NursingRecord } from "../chartData";

/** 診療録タブに表示する看護エントリ（フローシート・会話とリンク） */
export const PATIENT_A_NURSING_CLINICAL_RECORDS: ClinicalRecord[] = [
  {
    date: "2025/07/06",
    time: "07:00",
    profession: "看護",
    author: "看護師 佐々木",
    nursingRecordId: "nursing-a-night-voices",
    nursingFormat: "soap",
    nursingFocus: "不眠・幻聴",
    nursingObservation:
      "夜間、幻聴により入眠困難。「だめな人間だ、と聞こえる」と表出。ラジオを小音で流して対処。0時過ぎに不眠時ブロチゾラムを使用し2時頃入眠。",
    nursingIntervention: "傾聴し安心できる環境を整える。頓用薬の使用を確認。",
    nursingEvaluation: "幻聴と不眠の関連が明確。翌朝の眠気に留意。",
    content:
      "【看護記録】不眠・幻聴\n観察：夜間、幻聴により入眠困難。「だめな人間だ、と聞こえる」と表出。ラジオを小音で流して対処。0時過ぎに不眠時ブロチゾラムを使用し2時頃入眠。\n対応：傾聴し安心できる環境を整える。頓用薬の使用を確認。\n評価：幻聴と不眠の関連が明確。翌朝の眠気に留意。",
  },
  {
    date: "2025/07/05",
    time: "15:40",
    profession: "看護",
    author: "田中 花子",
    nursingRecordId: "nursing-a-courtyard-i",
    nursingFormat: "narrative",
    content:
      "【看護記録】15:40 午後、同室のIさんに誘われ中庭で過ごす。菓子を一つずつ分け合い、穏やかに会話。Aさんが自分から人と過ごす数少ない場面。「Iさんといると落ち着く」と話す。見守りの中で自然な交流を確認した。",
  },
  {
    date: "2025/07/04",
    time: "11:10",
    profession: "看護",
    author: "田中 花子",
    nursingRecordId: "nursing-a-med-interest",
    nursingFormat: "pos",
    nursingFocus: "服薬自己管理",
    content:
      "【看護記録】#服薬自己管理\nIさんが自分で服薬を管理している様子を見て、「Iさんがやっているなら自分にもできるかな」「うらやましいなぁ」と発言。\n服薬の必要性は理解しているが自己管理には自信がない様子。\n関心の芽生えとして医師・薬剤師と共有。",
  },
  {
    date: "2025/07/03",
    time: "10:00",
    profession: "看護",
    author: "看護師 佐々木",
    nursingRecordId: "nursing-a-cold",
    nursingFormat: "soap",
    nursingFocus: "感冒",
    nursingObservation: "朝より咽頭痛と鼻汁。微熱37.2℃。食事はやや減量したが摂取可能。",
    nursingIntervention: "水分摂取を促す。診察につなぎ、臨時処方開始を確認。安静と水分補給を説明。",
    nursingEvaluation: "上気道炎症状。悪化なく経過観察。",
    content:
      "【看護記録】感冒\n観察：朝より咽頭痛と鼻汁。微熱37.2℃。食事はやや減量したが摂取可能。\n対応：水分摂取を促す。診察につなぎ、臨時処方開始を確認。安静と水分補給を説明。\n評価：上気道炎症状。悪化なく経過観察。",
  },
  {
    date: "2025/07/02",
    time: "16:10",
    profession: "看護",
    author: "田中 花子",
    nursingRecordId: "nursing-a-uncle",
    nursingFormat: "soap",
    nursingFocus: "家族関係・自己評価",
    nursingObservation:
      "面会の話題から、叔父の面会が最近減っていることに触れる。「嫌われてしまったのかな」と沈んだ表情。電話で確認したかを尋ねると「していない」との返答。",
    nursingIntervention: "気持ちを傾聴。事実確認を急かさず受け止める。",
    nursingEvaluation: "対人関係と自己評価の低下がうかがえる。継続的な傾聴が必要。",
    content:
      "【看護記録】家族関係・自己評価\n観察：面会の話題から、叔父の面会が最近減っていることに触れる。「嫌われてしまったのかな」と沈んだ表情。電話で確認したかを尋ねると「していない」との返答。\n対応：気持ちを傾聴。事実確認を急かさず受け止める。\n評価：対人関係と自己評価の低下がうかがえる。継続的な傾聴が必要。",
  },
  {
    date: "2025/07/01",
    time: "11:30",
    profession: "看護",
    author: "田中 花子",
    nursingRecordId: "nursing-a-20250701-weight",
    nursingFormat: "pos",
    nursingFocus: "体重・栄養管理",
    content:
      "【看護記録】#体重・栄養管理\n体重測定70.2kg（前回より微減）。間食は一つ・非甘味飲料を継続できている。\n以前の脂質異常も改善傾向。本人は「少し軽くなった」と前向きな反応。\n取り組みを肯定し継続を支援。",
  },
  {
    date: "2021/06/19",
    time: "10:30",
    profession: "看護",
    author: "田中 花子",
    nursingFormat: "narrative",
    content:
      "【看護記録】入院翌日。入院時アセスメント実施。表情硬く、被害的な訴えあり。セルフケアは促しを要する。睡眠・食事・保清の状況を継続観察とする。",
  },
];

/** 看護記録タブ用（SOAP 約45% / POS 約25% / ナラティブ 約30%） */
export const PATIENT_A_NURSING_RECORDS: NursingRecord[] = [
  // ── 2025/07/09 ──
  {
    date: "2025/07/09",
    time: "16:00",
    author: "田中 花子",
    format: "chronological",
    content:
      "16:00 午後、Iさんに誘われ中庭で過ごす。表情は穏やか。「Iさんといると落ち着く」と話す。見守りの中で自然な交流を確認。申し送り：自発的な対人交流の場面あり。",
  },
  {
    date: "2025/07/09",
    time: "10:00",
    author: "田中 花子",
    format: "pos",
    focus: "日中活動・OT",
    body: "午前のOTに参加。革細工に取り組む。集中は続くが「疲れる」と早めに切り上げる。\n参加を肯定し、活動量は本人のペースに合わせる。",
  },
  {
    date: "2025/07/09",
    time: "07:30",
    author: "看護師 佐々木",
    type: "pos",
    format: "pos",
    problemNumber: "N1",
    focus: "睡眠・休息",
    course: "昨夜不眠時頓服使用。服用後は入眠。本朝は起床が遅く、「からだが重い」と話す。",
    posEvaluation: "頓服による入眠効果は得られたが、翌朝の持ち越しに注意が必要。",
    posPlan: "夜間睡眠と翌朝の状態を継続観察。",
  },
  // ── 2025/07/08 ──
  {
    date: "2025/07/08",
    time: "09:30",
    author: "田中 花子",
    type: "soap",
    format: "soap",
    focus: "SST・対人技能",
    s: "「少しは言えた」",
    o: "SSTに参加。ロールプレイでは緊張するが、最後まで参加できた。",
    a: "SST参加は定着傾向。参加体験を積み重ねる支援を継続。",
    p: "参加できたことを一緒に振り返り肯定。",
  },
  {
    date: "2025/07/08",
    time: "07:40",
    author: "看護師 佐々木",
    format: "pos",
    focus: "セルフケア・保清",
    body: "入浴日。促しで入浴・洗濯を実施。歯みがきは声かけで実施。\nできた点を伝え、促しで保清は保たれる。",
  },
  // ── 2025/07/07 ──
  {
    date: "2025/07/07",
    time: "08:30",
    author: "看護師 佐々木",
    type: "soap",
    format: "soap",
    focus: "不眠・頓服",
    s: "「からだが重い」。前夜の薬の影響で眠い。",
    o: "8時頃までやや遅く起床。表情に疲労感。",
    a: "前夜の頓用睡眠薬の影響で翌朝の倦怠感が生じている可能性がある。",
    p: "日中の傾眠に注意し、無理のない範囲で活動を促す。頓用の連用回避を継続。",
    observation: "前夜の頓用睡眠薬使用の影響か、8時頃までやや遅く起床。眠気と身体の重さを訴える。",
    intervention: "日中の傾眠に注意し、無理のない範囲で活動を促す。",
    evaluation: "翌朝への持ち越しあり。頓用の連用回避を継続。",
  },
  {
    date: "2025/07/07",
    time: "14:00",
    author: "田中 花子",
    format: "chronological",
    content:
      "14:00 OTは「気が向かない」と辞退。室内でラジオを聴いて過ごす。感冒症状は軽快傾向。辞退を尊重しつつ、SSTなど参加できる活動を確認した。",
  },
  // ── 2025/07/06 ──
  {
    date: "2025/07/06",
    time: "07:00",
    author: "看護師 佐々木",
    type: "soap",
    format: "soap",
    focus: "不眠・幻聴",
    nursingRecordId: "nursing-a-night-voices",
    s: "「今日は声が気になって、眠れそうにないです。」「だめな人間だ、と聞こえる」。",
    o: "消灯後も覚醒。表情に緊張あり。ラジオで対処。0時過ぎに頓用薬使用、2時頃入眠。",
    a: "夜間の幻聴により入眠困難が生じている可能性がある。自身で対処を試みた後に頓服を希望できている。",
    p: "不眠時頓服を使用。効果と翌朝の状態を観察する。",
    observation:
      "夜間、幻聴により入眠困難。「だめな人間だ、と聞こえる」と表出。ラジオで対処し0時過ぎに頓用薬使用、2時頃入眠。",
    intervention: "傾聴し安心できる環境を整える。頓用薬の使用を確認。",
    evaluation: "幻聴と不眠の関連が明確。翌朝の眠気に留意。",
  },
  // ── 2025/07/05 ──
  {
    date: "2025/07/05",
    time: "15:40",
    author: "田中 花子",
    format: "soap",
    focus: "対人関係",
    nursingRecordId: "nursing-a-courtyard-i",
    observation: "午後、Iさんと中庭で菓子を分け合い過ごす。会話は穏やか。",
    intervention: "自然な交流を見守る。",
    evaluation: "安心できる関係の中での交流。回復の資源として支援。",
  },
  {
    date: "2025/07/05",
    time: "10:30",
    author: "田中 花子",
    format: "chronological",
    content:
      "10:30 昼食全量摂取。間食は一つ・非甘味の飲み物を選択できている。本人の取り組みを肯定。食事・間食管理は良好に継続。",
  },
  // ── 2025/07/04 ──
  {
    date: "2025/07/04",
    time: "11:10",
    author: "田中 花子",
    type: "soap",
    format: "soap",
    focus: "服薬自己管理",
    nursingRecordId: "nursing-a-med-interest",
    s: "「自分にもできるかな」「うらやましい」",
    o: "Iさんの服薬自己管理の様子を見ていた。",
    a: "服薬自己管理への動機づけの芽。強みとして関わる。",
    p: "関心を受け止め、段階的な自己管理の可能性を医師・薬剤師と共有。",
  },
  {
    date: "2025/07/04",
    time: "07:30",
    author: "看護師 佐々木",
    format: "pos",
    focus: "排便",
    body: "3日ぶりに排便あり（前日センノシド使用）。腹部症状の訴えなし。\n排便間隔を観察。水分・活動を促す。",
  },
  // ── 2025/07/03 ──
  {
    date: "2025/07/03",
    time: "10:00",
    author: "看護師 佐々木",
    format: "soap",
    focus: "感冒",
    nursingRecordId: "nursing-a-cold",
    observation: "咽頭痛・鼻汁と微熱(37.2℃)。食事はやや減量したが摂取可能。",
    intervention: "水分補給・安静を促す。診察につなぐ。臨時処方を確認。",
    evaluation: "感冒症状。悪化なく経過観察。",
  },
  // ── 2025/07/02 ──
  {
    date: "2025/07/02",
    time: "16:10",
    author: "田中 花子",
    type: "soap",
    format: "soap",
    focus: "家族関係",
    nursingRecordId: "nursing-a-uncle",
    s: "「嫌われたのかな」",
    o: "叔父の面会が減っている話題に触れ、沈んだ表情。電話での確認はしていない。",
    a: "対人関係と自己評価の低下が関連。継続的な傾聴が必要。",
    p: "気持ちを傾聴。事実確認を急かさず受け止める。",
  },
  {
    date: "2025/07/02",
    time: "07:30",
    author: "看護師 佐々木",
    format: "soap",
    focus: "睡眠",
    observation: "前夜、幻聴で入眠がやや遅れる。頓用薬は使用せず経過。朝食全量。",
    intervention: "睡眠状況を確認。日中の活動を促す。",
    evaluation: "軽度の入眠困難。頓用なしで経過した日。",
  },
  // ── 2025/07/01 ──
  {
    date: "2025/07/01",
    time: "11:30",
    author: "田中 花子",
    type: "soap",
    format: "soap",
    focus: "体重管理",
    nursingRecordId: "nursing-a-20250701-weight",
    s: "「少し軽くなった」",
    o: "体重測定70.2kg。間食制限を継続できている。",
    a: "体重管理は順調。動機づけを維持。",
    p: "体重減少を一緒に確認し肯定。",
  },
  {
    date: "2025/07/01",
    time: "09:30",
    author: "田中 花子",
    format: "pos",
    focus: "SST",
    body: "SSTに参加。挨拶の練習に取り組む。\n参加を肯定。SST参加が定着。",
  },
  // ── 2025/06/30 ──
  {
    date: "2025/06/30",
    time: "10:00",
    author: "看護師 佐々木",
    format: "chronological",
    content:
      "10:00 洗濯を実施。入浴後にため込んでいた下着をまとめて洗う様子。洗濯物のため込みに気づき、こまめに行えるよう声かけ。保清行動は促しで維持。",
  },
  // ── 2025/06/29 ──
  {
    date: "2025/06/29",
    time: "08:30",
    author: "看護師 佐々木",
    format: "soap",
    focus: "睡眠・活動",
    observation: "前夜の頓用薬の影響で午前は臥床がち。午後はIさんと中庭へ。",
    intervention: "日中の活動を無理なく促す。",
    evaluation: "睡眠薬使用翌日の活動低下。交流はできている。",
  },
  // ── 2025/06/28 ──
  {
    date: "2025/06/28",
    time: "07:00",
    author: "看護師 佐々木",
    format: "soap",
    focus: "不眠・幻聴",
    observation: "夜間、幻聴で入眠困難。0時過ぎに頓用ブロチゾラム使用。",
    intervention: "ラジオでの対処を確認。頓用薬の使用を記録。",
    evaluation: "幻聴による不眠。頓用で対応。",
  },
  // ── 2025/06/27 ──
  {
    date: "2025/06/27",
    time: "09:30",
    author: "田中 花子",
    format: "pos",
    focus: "セルフケア・活動",
    body: "SST参加。入浴・洗濯も促しで実施。\n参加とセルフケアを肯定。活動・保清ともに促しで維持。",
  },
  // ── 2025/06/26 ──
  {
    date: "2025/06/26",
    time: "14:00",
    author: "田中 花子",
    format: "chronological",
    content:
      "14:00 OTは辞退し室内でラジオを聴く。日中の活動量は少なめ。辞退を尊重し、関心のある活動を確認。OT辞退が多い日。",
  },
  // ── 2025/06/25 ──
  {
    date: "2025/06/25",
    time: "10:30",
    author: "看護師 佐々木",
    format: "chronological",
    content:
      "10:30 日中は病室で過ごすことが多い。促しでデイルームへ短時間。無理のない範囲で日中活動を促す。活動低下は継続課題。",
  },
  // ── 2025/06/22 ──
  {
    date: "2025/06/22",
    time: "20:30",
    author: "看護師 佐々木",
    format: "chronological",
    content:
      "20:30 「お金が足りなくなった」と2週間分の前借りを希望。金銭管理に困難。計画的な使い方を一緒に整理。継続的な関わりが必要。",
  },
  // ── 2025/06/20 ──
  {
    date: "2025/06/20",
    time: "11:00",
    author: "田中 花子",
    format: "soap",
    focus: "栄養",
    observation: "栄養指導を受ける。間食・飲み物の選び方を確認。",
    intervention: "取り組みを肯定し継続を励ます。",
    evaluation: "体重・脂質改善への意欲は保たれている。",
  },
  // ── 2025/06/18 ──
  {
    date: "2025/06/18",
    time: "21:00",
    author: "看護師 佐々木",
    type: "soap",
    format: "soap",
    focus: "便秘",
    s: "「お腹が張る」",
    o: "便秘の訴えあり。センノシドの使用を希望。",
    a: "便秘は自ら訴え頓用を希望できる。セルフモニタリングは可能。",
    p: "頓用センノシドを確認し使用。水分・活動を促す。",
  },
  // ── 2025/06/15 ──
  {
    date: "2025/06/15",
    time: "10:00",
    author: "田中 花子",
    format: "chronological",
    content:
      "10:00 心理教育の案内をするが「今日はいい」と辞退。SSTには参加すると話す。本人の選択を尊重。参加できる活動を糸口に支援。",
  },
  // ── 2025/06/10 ──
  {
    date: "2025/06/10",
    time: "14:30",
    author: "田中 花子",
    format: "chronological",
    content:
      "14:30 退院の話題に「ここにいる方が安心」と発言。表情は穏やか。気持ちを傾聴し、焦らせない関わりを心がける。地域生活への不安が背景。",
  },
  // ── 2025/06/05 ──
  {
    date: "2025/06/05",
    time: "08:00",
    author: "看護師 佐々木",
    format: "pos",
    focus: "セルフケア・口腔",
    body: "歯みがきを忘れがち。声かけで実施。洗面は自立。\n口腔ケアは促しを要する。習慣化を支援。",
  },
  // ── 2025/05/28 ──
  {
    date: "2025/05/28",
    time: "13:30",
    author: "田中 花子",
    format: "chronological",
    content:
      "13:30 Iさんと将棋盤を挟んで過ごす。穏やかな時間。交流を見守る。安心できる関係が活動の広がりにつながる。",
  },
];
