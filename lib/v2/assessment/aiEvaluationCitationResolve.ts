// Compass Version 2.2 Sprint 5C — citation が提出 snapshot 内に存在するか検証

import type { SnapshotReadModelOk } from "./snapshotReadModel";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getByPath(root: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (Array.isArray(cur)) {
      const idx = Number(p);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
      continue;
    }
    if (!isRecord(cur) || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function hasCardId(
  cards: Array<Record<string, unknown>>,
  id: string,
): boolean {
  return cards.some((c) => {
    const cid =
      typeof c.id === "string"
        ? c.id
        : typeof c.information_card_id === "string"
          ? c.information_card_id
          : null;
    return cid === id;
  });
}

/**
 * package 上の field_path は student_submission.* だが、
 * 教員確認では提出 snapshot の対応領域を見る。
 */
export function resolveAiEvaluationCitation(input: {
  fieldPath: string | null;
  anonymousObjectId: string | null;
  snapshot: SnapshotReadModelOk | null;
}): {
  resolveStatus: "ok" | "missing" | "excluded_evidence_links" | "unknown";
  resolveMessage: string | null;
} {
  const { fieldPath, anonymousObjectId, snapshot } = input;
  if (!fieldPath && !anonymousObjectId) {
    return {
      resolveStatus: "unknown",
      resolveMessage: "引用の field_path / anonymous_object_id がありません。",
    };
  }

  if (fieldPath && /evidence_links/i.test(fieldPath)) {
    return {
      resolveStatus: "excluded_evidence_links",
      resolveMessage:
        "form2_evidence_links は様式2の評価根拠として使いません（引用は参考外）。",
    };
  }

  if (!snapshot) {
    return {
      resolveStatus: "unknown",
      resolveMessage: "提出スナップショットを照合できませんでした。",
    };
  }

  // student_submission.X → snapshot 側の対応
  let localPath = fieldPath ?? "";
  if (localPath.startsWith("student_submission.")) {
    localPath = localPath.slice("student_submission.".length);
  }

  if (localPath.startsWith("information_cards") || localPath === "information_cards") {
    if (anonymousObjectId) {
      const ok = hasCardId(snapshot.informationCards, anonymousObjectId);
      // form3 内カードも候補
      const form3Cards = Array.isArray(snapshot.form3?.informationCards)
        ? (snapshot.form3!.informationCards as unknown as Array<Record<string, unknown>>)
        : [];
      const ok3 = hasCardId(
        form3Cards.map((c) => (isRecord(c) ? c : {})),
        anonymousObjectId,
      );
      if (ok || ok3) {
        return { resolveStatus: "ok", resolveMessage: null };
      }
      return {
        resolveStatus: "missing",
        resolveMessage: `情報カード ${anonymousObjectId} が提出 snapshot に見つかりません。`,
      };
    }
    if (snapshot.informationCards.length > 0 || (snapshot.form3?.informationCards?.length ?? 0) > 0) {
      return { resolveStatus: "ok", resolveMessage: null };
    }
    return {
      resolveStatus: "missing",
      resolveMessage: "提出 snapshot に情報カードがありません。",
    };
  }

  if (localPath.startsWith("field_reflections")) {
    if (snapshot.fieldReflections.length === 0) {
      return {
        resolveStatus: "missing",
        resolveMessage: "提出 snapshot にフィールド振り返りがありません。",
      };
    }
    return { resolveStatus: "ok", resolveMessage: null };
  }

  if (localPath.startsWith("patient_understanding")) {
    if (!snapshot.patientUnderstanding?.overviewText?.trim()) {
      return {
        resolveStatus: "missing",
        resolveMessage: "提出 snapshot に患者理解がありません。",
      };
    }
    return { resolveStatus: "ok", resolveMessage: null };
  }

  if (localPath.startsWith("form2")) {
    if (!snapshot.form2) {
      return {
        resolveStatus: "missing",
        resolveMessage: "提出 snapshot に様式2がありません。",
      };
    }
    const sub = localPath.replace(/^form2\.?/, "");
    if (!sub) return { resolveStatus: "ok", resolveMessage: null };
    const hit = getByPath(snapshot.form2, sub);
    if (hit === undefined) {
      return {
        resolveStatus: "missing",
        resolveMessage: `様式2の参照先 ${sub} が見つかりません。`,
      };
    }
    return { resolveStatus: "ok", resolveMessage: null };
  }

  if (localPath.startsWith("form3")) {
    if (!snapshot.form3) {
      return {
        resolveStatus: "missing",
        resolveMessage: "提出 snapshot に様式3がありません。",
      };
    }
    if (anonymousObjectId) {
      const info = (snapshot.form3.informationCards ?? []) as unknown as Array<
        Record<string, unknown>
      >;
      const assess = (snapshot.form3.assessmentCards ?? []) as unknown as Array<
        Record<string, unknown>
      >;
      if (
        hasCardId(info.map((c) => (isRecord(c) ? c : {})), anonymousObjectId) ||
        hasCardId(assess.map((c) => (isRecord(c) ? c : {})), anonymousObjectId)
      ) {
        return { resolveStatus: "ok", resolveMessage: null };
      }
      return {
        resolveStatus: "missing",
        resolveMessage: `様式3カード ${anonymousObjectId} が見つかりません。`,
      };
    }
    return { resolveStatus: "ok", resolveMessage: null };
  }

  // 未知パス: path があれば一応警告、id だけなら unknown
  if (fieldPath) {
    return {
      resolveStatus: "unknown",
      resolveMessage: `引用パス ${fieldPath} の照合ルールが未定義です。教員が内容を確認してください。`,
    };
  }
  return {
    resolveStatus: "unknown",
    resolveMessage: "引用先を自動照合できませんでした。",
  };
}
