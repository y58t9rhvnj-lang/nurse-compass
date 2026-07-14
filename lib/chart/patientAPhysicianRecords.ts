// Sprint A-3.1 / 電子カルテ改善: 患者A 医師記録。
// POS（問題リスト #1〜#9）に沿って連続性を持たせ、経過記録は S/O/A/P 構造で記載する。
// 指示記録・問題リストは SOAP ではないため従来どおり POS 本文で保持する。
import type { ClinicalRecord } from "../chartData";

const AUTHOR = "鈴木 一郎 医師";

const PROBLEM_NAMES: Record<number, string> = {
  1: "統合失調症",
  2: "幻聴",
  3: "不眠",
  4: "日中活動性低下・倦怠感",
  5: "肥満傾向・脂質代謝管理",
  6: "便秘",
  7: "服薬自己管理への不安",
  8: "退院・地域生活への不安",
  9: "一時的身体症状（感冒等）",
};

/** POS中心の簡潔記録（指示記録・問題リスト用の本文） */
function posRecord(title: string, problems: number[], body: string): string {
  const tags = problems.map((n) => `#${n} ${PROBLEM_NAMES[n] ?? ""}`).join("\n");
  return `【${title}】\n${tags}\n${body}`;
}

type PhyInput = Omit<ClinicalRecord, "profession" | "author"> & {
  profession?: string;
  author?: string;
};

function phy(rec: PhyInput): ClinicalRecord {
  const { soap, problems, ...rest } = rec;
  let content = rest.content;
  if (problems && problems.length > 0) {
    const tags = problems.map((n) => `#${n} ${PROBLEM_NAMES[n] ?? ""}`).join("\n");
    if (soap) {
      // SOAP記録は問題タグ＋S/O/A/Pラベル付きの本文へ正規化（検索・整合性検証用）
      const header = rest.content.includes("\n")
        ? rest.content.split("\n")[0]
        : rest.content.startsWith("【")
          ? rest.content
          : `【精神科 経過記録】`;
      const titleLine = header.startsWith("【") ? header : `【精神科 経過記録】`;
      const parts: string[] = [titleLine, tags];
      if (soap.s) parts.push(`S:\n${soap.s}`);
      if (soap.o) parts.push(`O:\n${soap.o}`);
      if (soap.a) parts.push(`A:\n${soap.a}`);
      if (soap.p) parts.push(`P:\n${soap.p}`);
      content = parts.join("\n");
    } else if (!rest.content.includes("#1 ") && !rest.content.includes(`#${problems[0]} `)) {
      // posRecord 未使用の旧形式 content を POS 形式へ正規化
      const title = rest.content.startsWith("【")
        ? rest.content.split("\n")[0]
        : `【精神科 経過記録】`;
      const body = rest.content.startsWith("【")
        ? rest.content.slice(title.length).trim() || rest.content
        : rest.content;
      const bodyText = body.startsWith("【") ? body.replace(/^【[^】]+】\s*/, "") : body;
      content = `${title}\n${tags}\n${bodyText}`;
    }
  }
  return {
    profession: "医師",
    author: AUTHOR,
    ...rest,
    content,
    problems,
    soap,
  };
}

// ── 安定した問題リスト（POS） ─────────────────────
// #1 統合失調症 / #2 幻聴 / #3 不眠 / #4 日中活動性低下・倦怠感
// #5 肥満傾向・脂質代謝管理 / #6 便秘 / #7 服薬自己管理への不安
// #8 退院・地域生活への不安 / #9 一時的な身体症状（感冒等、該当期間のみ）

export const PATIENT_A_PHYSICIAN_RECORDS: ClinicalRecord[] = [
  // ═══ 2025 直近 2〜4週 ═══
  phy({
    id: "clinical-a-20250709-stable",
    date: "2025/07/09",
    time: "09:10",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "服薬拒否なし。幻聴は残存するが著明な行動化なし。",
      a: "病棟生活は概ね安定。",
      p: "現行処方継続、経過観察。",
    },
  }),
  phy({
    id: "clinical-a-conference-20250707",
    date: "2025/07/07",
    time: "14:00",
    problems: [1, 2, 3, 4, 7, 8],
    content: "【精神科 経過記録 多職種カンファレンス】",
    soap: {
      s: "「だいたい、変わりない」と話す。SSTには出るようになった。",
      o: "症状は概ね安定。残遺する幻聴と入眠困難、日中活動の低下が継続。SST参加は定着。体重は約70kg台。",
      a: "維持期として安定。回復のサイン（SST・体重管理・服薬関心）あり。退院支援は段階的に継続。",
      p: "現行処方継続。自己管理能力の向上と地域生活の検討を多職種で共有。GAF 50。",
    },
  }),
  phy({
    id: "clinical-a-20250707-cold-end",
    date: "2025/07/07",
    time: "09:00",
    problems: [9],
    medicationChangeId: "rx-a-20250703-kanbou",
    content: "【精神科 経過記録】",
    soap: {
      s: "「喉はもう、だいぶ楽です。」",
      o: "体温平熱。咽頭発赤軽度残存。呼吸音清。",
      a: "感冒症状は軽快。臨時処方は不要な水準。",
      p: "臨時処方（カルボシステイン・トラネキサム酸）を終了。現行の定期・頓服は継続。#9 は経過観察後にクローズ予定。",
    },
  }),
  phy({
    id: "clinical-a-sleep-voices",
    date: "2025/07/06",
    time: "09:20",
    problems: [2, 3],
    content: "【精神科 経過記録】",
    soap: {
      s: "「夜になると声が気になります。眠れない日があります。」",
      o: "表情は概ね穏やか。会話は成立。著明な行動化なし。看護記録に夜間の幻聴・頓用ブロチゾラム使用あり。",
      a: "夜間を中心に幻聴が残存し入眠困難をきたしているが、急性増悪を示す所見はない。",
      p: "現行処方継続。睡眠状況および夜間の対処（ラジオ・頓服）を観察。頓用の連用は避ける。",
    },
  }),
  phy({
    id: "clinical-a-20250705-cold-fu",
    date: "2025/07/05",
    time: "10:30",
    problems: [9],
    content: "【精神科 経過記録】",
    soap: {
      s: "「鼻水はまだ少しありますが、熱は下がりました。」",
      o: "体温36.8℃。咽頭発赤軽度。呼吸音清。",
      a: "感冒症状は改善傾向。",
      p: "臨時処方継続。数日で終了予定。悪化時は再診。",
    },
  }),
  phy({
    id: "clinical-a-cold-20250703",
    date: "2025/07/03",
    time: "13:20",
    problems: [9],
    medicationChangeId: "rx-a-20250703-kanbou",
    content: "【精神科 経過記録】",
    soap: {
      s: "「喉が痛くて、鼻水も出ます。」",
      o: "体温37.2℃。咽頭発赤軽度。呼吸音清、肺炎を疑う所見なし。",
      a: "上気道炎（感冒）と判断。",
      p: "対症療法として臨時処方（カルボシステイン・トラネキサム酸、発熱時アセトアミノフェン）。数日で軽快を見込む。",
    },
  }),
  phy({
    id: "clinical-a-20250702-constipation",
    date: "2025/07/02",
    time: "09:40",
    problems: [6],
    content: "【精神科 経過記録】",
    soap: {
      s: "「お腹が張って、3日くらい出ていません。」",
      o: "腹部膨満軽度。圧痛なし。排便記録に3日間隔。",
      a: "便秘傾向。閉塞や急性腹症の徴候なし。",
      p: "頓用センノシド使用を確認。水分・活動を促す。頓用の頻度を定期的にレビュー。",
    },
  }),
  phy({
    id: "clinical-a-problemlist",
    date: "2025/07/01",
    time: "10:00",
    problems: [1, 2, 3, 4, 5, 6, 7, 8],
    content:
      "【問題リスト（POS）】#1 統合失調症（維持療法中）／#2 幻聴（夜間に「だめな人間だ」「怠け者」等）／#3 不眠（入眠困難、幻聴と関連）／#4 日中活動性低下・倦怠感（OT辞退が多い）／#5 肥満傾向・脂質代謝管理（体重約70kg、改善傾向）／#6 便秘（3〜5日間隔）／#7 服薬自己管理への不安（必要性は理解、自信に乏しい）／#8 退院・地域生活への不安。以上を継続評価する。",
  }),
  phy({
    id: "clinical-a-20250701-rx-review",
    date: "2025/07/01",
    time: "09:35",
    problems: [1, 3],
    medicationChangeId: "rx-a-teiki-current",
    content: "【精神科 指示記録】",
    soap: {
      s: "「薬は、飲んでいます。」",
      o: "服薬拒否なし。副作用の新規訴えなし。",
      a: "現行の定期・頓服で維持可能。",
      p: "定期処方・頓用処方を継続発行。頓用睡眠薬の使用頻度を月1回程度レビュー。",
    },
  }),
  phy({
    id: "clinical-a-20250628-lab-review",
    date: "2025/06/28",
    time: "10:00",
    problems: [5],
    orderId: "order-a-labs-20250620",
    content: "【精神科 経過記録】",
    soap: {
      s: "「体重は、少し減りました。」",
      o: "6/20採血：LDL 118、TG 130、HbA1c 5.6。肝腎機能正常。心電図 QTc 420ms。体重70.2kg。",
      a: "以前の脂質異常は改善。HbA1cは安定。向精神薬によるQT延長なし。",
      p: "現行処方継続。間食制限と体重管理を継続。次回採血は6ヶ月後を目安。",
    },
  }),
  phy({
    id: "clinical-a-20250628-sleep-prn",
    date: "2025/06/28",
    time: "09:15",
    problems: [3],
    content: "【精神科 経過記録】",
    soap: {
      s: "「昨夜は声が気になって、なかなか眠れませんでした。」",
      o: "不眠時頓服使用あり。服用後は入眠。翌朝は起床遅延と軽度倦怠感あり。",
      a: "夜間幻聴に伴う入眠困難が散発。頓服は有効だが翌朝への持ち越しに注意を要する。",
      p: "現行定期処方は継続。頓服使用頻度と翌朝の状態を観察。",
    },
  }),
  phy({
    id: "clinical-a-20250625",
    date: "2025/06/25",
    time: "10:30",
    problems: [1, 4],
    content: "【精神科 経過記録】",
    soap: {
      o: "残遺する幻聴は持続するが日中の被害的訴えは目立たない。OTは気が向かず辞退する日が多いが、SSTには継続参加。",
      a: "症状は概ね安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-orders-20250620",
    date: "2025/06/20",
    time: "09:40",
    problems: [5],
    orderId: "order-a-labs-20250620",
    content: posRecord(
      "指示記録",
      [5],
      "定期採血（CBC・生化学・脂質・HbA1c・肝腎機能）をオーダー。抗精神病薬使用中のため心電図（QT評価）も併せて依頼。体重・腹囲の定期測定を継続する。",
    ),
  }),
  phy({
    id: "clinical-a-discharge",
    date: "2025/06/10",
    time: "10:20",
    problems: [8],
    content: "【精神科 経過記録】",
    soap: {
      s: "「ここにいる方が安心です。外に出るのは、まだ不安です。」",
      o: "穏やか。会話は成立。",
      a: "退院・地域生活への不安が背景。単なる退院拒否ではない。",
      p: "焦らず段階的に外の生活のイメージづくりを進める。PSWと住居・経済面を継続検討。",
    },
  }),
  phy({
    id: "clinical-a-20250605-med-selfmgmt",
    date: "2025/06/05",
    time: "11:00",
    problems: [7],
    content: "【精神科 経過記録】",
    soap: {
      s: "「Iさんは自分で薬を飲んでいます。自分にもできるかな、と思いますが、間違えたら怖いです。」",
      o: "服薬は看護管理で確実。同室Iさんの自己管理を観察している様子。",
      a: "服薬の必要性は理解。自己管理への関心と不安が併存。",
      p: "即時の自己管理移行は行わない。薬剤師・看護と段階的評価を継続。まず就寝前薬からの検討を将来視野に。",
    },
  }),
  phy({
    id: "clinical-a-20250520-stable",
    date: "2025/05/20",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "服薬拒否なし。幻聴は夜間に残存するが日中は穏やか。",
      a: "病状は概ね安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20250415-prn-review",
    date: "2025/04/15",
    time: "10:00",
    problems: [3, 6],
    content: "【精神科 経過記録】",
    soap: {
      s: "「眠れない時は、頓服をもらっています。お腹の調子は、3日に一度くらいです。」",
      o: "先月の頓用ブロチゾラム使用は3回、センノシドは2回。いずれも効果あり。",
      a: "頓用の使用頻度は許容範囲。依存の徴候なし。",
      p: "頓用処方を継続。使用頻度を月次でレビュー。",
    },
  }),
  phy({
    id: "clinical-a-20250310-stable",
    date: "2025/03/10",
    time: "09:20",
    problems: [1, 4],
    content: "【精神科 経過記録】",
    soap: {
      o: "日中は病室で過ごすことが多い。SSTには参加傾向。",
      a: "症状安定。",
      p: "現行処方継続。",
    },
  }),
  phy({
    id: "clinical-a-20250115-stable",
    date: "2025/01/15",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "急性増悪の徴候なし。",
      a: "年始の経過確認。病状は概ね安定。",
      p: "現行治療継続。",
    },
  }),

  // ═══ 2024 前年 ═══
  phy({
    id: "clinical-a-20241220-yearend",
    date: "2024/12/20",
    time: "10:00",
    problems: [1, 5, 8],
    content: "【精神科 経過記録】",
    soap: {
      o: "体重はやや高値だが間食制限に取り組み始めた。退院先は未定で地域生活への不安は継続。",
      a: "年末経過。症状は概ね安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20241110-weight",
    date: "2024/11/10",
    time: "09:40",
    problems: [5],
    content: "【精神科 経過記録】",
    soap: {
      s: "「間食を一つにしているんですが、まだ太っている気がします。」",
      o: "体重約78kg。腹囲約88cm。食事は概ね全量。",
      a: "過体重・脂質管理が課題。意欲はある。",
      p: "間食制限を継続。活動量確保を多職種で支援。次回採血で脂質を再評価。",
    },
  }),
  phy({
    id: "clinical-a-20241005-selfmgmt",
    date: "2024/10/05",
    time: "11:00",
    problems: [7],
    content: "【精神科 経過記録】",
    soap: {
      s: "「薬は必要だと思います。でも、自分で管理するのは、まだ難しそうです。」",
      o: "服薬遵守良好。看護管理下。",
      a: "服薬の必要性は理解。自己管理への自信は乏しい。",
      p: "自己管理の移行は時期尚早。経過観察を継続。",
    },
  }),
  phy({
    id: "clinical-a-20240920-ot",
    date: "2024/09/20",
    time: "09:30",
    problems: [4],
    content: "【精神科 経過記録】",
    soap: {
      o: "OTは気が向かず辞退する日が多い。SSTには時々参加。",
      a: "日中活動の低下は継続課題。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20240805-sleep",
    date: "2024/08/05",
    time: "10:00",
    problems: [2, 3],
    content: "【精神科 経過記録】",
    soap: {
      s: "「夜になると声が気になることがあります。」",
      o: "表情穏やか。行動化なし。ラジオを聴いて対処しているとのこと。",
      a: "夜間中心の残遺幻聴。入眠困難あり。急性増悪なし。",
      p: "現行処方継続。睡眠・幻聴の経過観察。",
    },
  }),
  phy({
    id: "clinical-a-20240820-discharge-discuss",
    date: "2024/08/20",
    time: "10:30",
    problems: [8],
    content: "【精神科 経過記録】",
    soap: {
      s: "「まだ、考えたくない」とのこと。",
      o: "退院後の生活について話を聞く。",
      p: "焦らず本人のペースを尊重。住居・経済面はPSWと継続検討。",
    },
  }),
  phy({
    id: "clinical-a-20240701-stable",
    date: "2024/07/01",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "服薬拒否なし。",
      a: "上半期の経過確認。病状は概ね安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20240620-lab-review",
    date: "2024/06/20",
    time: "11:00",
    problems: [5],
    orderId: "order-a-labs-20240615",
    content: "【精神科 経過記録】",
    soap: {
      s: "「特に気になることはありません。」",
      o: "6/15採血：LDL 138、TG 158（H）、HbA1c 5.7。肝腎機能正常。",
      a: "脂質は境界〜軽度高値。HbA1cは安定。",
      p: "現行処方継続。食事・活動の見直しを継続。次回採血で再評価。",
    },
  }),
  phy({
    id: "clinical-a-20240615-orders",
    date: "2024/06/15",
    time: "09:30",
    problems: [5],
    orderId: "order-a-labs-20240615",
    content: posRecord(
      "指示記録",
      [5],
      "定期採血（CBC・脂質・HbA1c・肝腎機能）をオーダー。体重・腹囲測定を継続。",
    ),
  }),
  phy({
    id: "clinical-a-20240410-constipation",
    date: "2024/04/10",
    time: "09:50",
    problems: [6],
    content: "【精神科 経過記録】",
    soap: {
      o: "便秘の訴えあり。3〜4日間隔。腹部所見に著変なし。",
      a: "頓用センノシドで改善。",
      p: "頓用継続・水分・活動を促す。",
    },
  }),
  phy({
    id: "clinical-a-20240215-stable",
    date: "2024/02/15",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "服薬拒否なし。幻聴は夜間に残存。",
      a: "病状は概ね安定。",
      p: "現行治療継続。",
    },
  }),

  // ═══ 2023 任意入院移行 ═══
  phy({
    id: "clinical-a-20231120-review",
    date: "2023/11/20",
    time: "10:00",
    problems: [1, 8],
    content: "【精神科 経過記録】",
    soap: {
      o: "退院先は未定。",
      a: "任意入院移行後、症状は安定。",
      p: "地域生活に向けた支援を段階的に開始。現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20230715-post-voluntary",
    date: "2023/07/15",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "服薬拒否なし。生活リズムは保たれている。",
      a: "任意入院移行後2週間。病状は安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-voluntary-20230710",
    date: "2023/07/10",
    time: "11:00",
    problems: [1, 8],
    content: "【精神科 経過記録】",
    soap: {
      s: "「任意入院になっても、ここにいるのは変わりません。」",
      o: "症状安定。病識は一定程度あり。",
      a: "任意入院への移行が可能な状態。",
      p: "本人同意のもと任意入院へ移行。退院先は未定。地域生活に向けた支援を進める。",
    },
  }),
  phy({
    id: "clinical-a-20230601-stable",
    date: "2023/06/01",
    time: "09:30",
    problems: [1, 2],
    content: "【精神科 経過記録】",
    soap: {
      o: "幻聴は夜間に残存。",
      a: "症状安定。任意入院移行に向けた病識・安定性を確認。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20230520-stable",
    date: "2023/05/20",
    time: "09:40",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "幻聴は夜間に残存するが日中は穏やか。",
      a: "症状は概ね安定。",
      p: "任意入院移行に向けた準備を継続検討。",
    },
  }),
  phy({
    id: "clinical-a-20230210-stable",
    date: "2023/02/10",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "服薬拒否なし。",
      a: "病状は概ね安定。",
      p: "現行治療継続。",
    },
  }),

  // ═══ 2022 安定期 ═══
  phy({
    id: "clinical-a-20221220-yearend",
    date: "2022/12/20",
    time: "10:00",
    problems: [1, 5],
    content: "【精神科 経過記録】",
    soap: {
      o: "体重はやや多め（約79kg）。",
      a: "年末経過。症状安定。",
      p: "脂質管理の必要性を説明。現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20221210-lab-review",
    date: "2022/12/10",
    time: "11:00",
    problems: [5],
    orderId: "order-a-labs-20221210",
    content: "【精神科 経過記録】",
    soap: {
      s: "「食べ過ぎかもしれません。」",
      o: "採血：LDL 155（H）、TG 172（H）、HbA1c 5.7。体重約79kg。",
      a: "過体重に伴う脂質異常。",
      p: "食事・活動の見直しを助言。現行処方は維持。",
    },
  }),
  phy({
    id: "clinical-a-20221205-weight-order",
    date: "2022/12/05",
    time: "09:30",
    problems: [5],
    orderId: "order-a-labs-20221210",
    content: posRecord(
      "指示記録",
      [5],
      "体重増加・脂質異常のフォローのため採血（脂質・HbA1c・肝機能）をオーダー。",
    ),
  }),
  phy({
    id: "clinical-a-20220915-stable",
    date: "2022/09/15",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "日中活動は少なめ。",
      a: "症状は概ね安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20220701-stable",
    date: "2022/07/01",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      a: "上半期経過。病状は概ね安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20220620-progress",
    date: "2022/06/20",
    time: "10:00",
    problems: [1, 4],
    content: "【精神科 経過記録】",
    soap: {
      o: "日中は室内で過ごすことが多い。OT参加は不安定。",
      a: "症状安定。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20220315-stable",
    date: "2022/03/15",
    time: "09:30",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "服薬拒否なし。",
      a: "病状は概ね安定。",
      p: "現行治療継続。",
    },
  }),

  // ═══ 2021 入院・初期 ═══
  phy({
    id: "clinical-a-20211020-stabilization",
    date: "2021/10/20",
    time: "10:00",
    problems: [1, 2],
    content: "【精神科 経過記録】",
    soap: {
      o: "幻聴は軽減したが夜間に残存。就寝前の変更（クエチアピン）後、起床困難は改善。",
      a: "入院後、症状は安定化傾向。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20210925-post-change",
    date: "2021/09/25",
    time: "09:30",
    problems: [1, 3],
    medicationChangeId: "rx-a-quetiapine-202109",
    content: "【精神科 経過記録】",
    soap: {
      s: "「朝、少し起きやすくなった気がします。」",
      o: "日中の眠気は軽減。服薬拒否なし。",
      a: "クロルプロマジン中止・クエチアピンへの変更後、過鎮静は改善。",
      p: "現行処方で経過観察。",
    },
  }),
  phy({
    id: "clinical-a-chlorpromazine-20210915",
    date: "2021/09/15",
    time: "10:00",
    problems: [1, 3],
    medicationChangeId: "rx-a-quetiapine-202109",
    content: "【精神科 指示記録】",
    soap: {
      s: "「朝、なかなか起きられません。」",
      o: "起床困難・日中眠気あり。就寝前クロルプロマジン使用中。",
      a: "就寝前のクロルプロマジンによる過鎮静が疑われる。",
      p: "クロルプロマジンを中止し、就寝前をクエチアピン50mgへ変更。日中の眠気と起床の改善を期待し経過をみる。",
    },
  }),
  phy({
    id: "clinical-a-20210815-stable",
    date: "2021/08/15",
    time: "09:40",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      o: "被害的訴えは減少。服薬拒否なし。",
      a: "症状は改善傾向。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20210720-voices",
    date: "2021/07/20",
    time: "10:00",
    problems: [2, 3],
    content: "【精神科 経過記録】",
    soap: {
      s: "「夜になると、まだ声が聞こえることがあります。」",
      o: "表情はやや硬いが会話は成立。行動化なし。",
      a: "夜間の幻聴が残存。入眠困難あり。",
      p: "現行処方継続。睡眠・幻聴の経過観察。",
    },
  }),
  phy({
    id: "clinical-a-20210705-admission-lab-review",
    date: "2021/07/05",
    time: "11:00",
    problems: [5],
    orderId: "order-a-labs-20210701",
    content: "【精神科 経過記録】",
    soap: {
      s: "「特に変わりません。」",
      o: "7/2採血：LDL 162（H）、TG 185（H）、HbA1c 5.8。体重約80kg。",
      a: "入院初期。過体重と脂質異常あり。",
      p: "食事・活動の見直しを計画。向精神薬による血糖モニタリングを開始。",
    },
  }),
  phy({
    id: "clinical-a-20210701-admission-orders",
    date: "2021/07/01",
    time: "09:00",
    problems: [1, 5],
    orderId: "order-a-labs-20210701",
    content: posRecord(
      "指示記録",
      [1, 5],
      "入院時採血（CBC・脂質・HbA1c・肝腎機能）および胸部X線をオーダー。",
    ),
  }),
  phy({
    id: "clinical-a-20210701-midyear",
    date: "2021/07/01",
    time: "14:00",
    problems: [1],
    content: "【精神科 経過記録】",
    soap: {
      a: "入院後2週間。症状は改善傾向。",
      p: "生活リズムの再構築を継続。現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-20210625-early",
    date: "2021/06/25",
    time: "10:30",
    problems: [1, 2],
    content: "【精神科 経過記録】",
    soap: {
      o: "被害的訴えはやや減少。夜間の幻聴は残存。服薬は看護管理で確実。",
      a: "入院1週間。",
      p: "現行治療継続。",
    },
  }),
  phy({
    id: "clinical-a-admission",
    date: "2021/06/18",
    time: "14:00",
    problems: [1],
    medicationChangeId: "rx-a-admission-2021",
    content: "【精神科 入院時記録】",
    soap: {
      s: "「家に帰れなくなりました。声が聞こえて、落ち着きません。」",
      o: "緊張強い。被害的。会話は可能。",
      a: "統合失調症の再燃。5回目の入院。生活破綻・住居喪失。",
      p: "医療保護入院とし、薬物療法を開始。安全確保と安定化を優先。入院時処方開始。",
    },
  }),
];
