/**
 * Sprint 5D — ZIP 読み書き（fflate）と README
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { normalizeZipPath } from "@/lib/v2/assessment/aiEvaluationBatchManifest";

export const AI_EVAL_BATCH_EXPORT_README = `Nurse Compass — AI Evaluation Package Batch (Export)

【用途】
この ZIP は、教員が外部 AI（Claude / GPT / Gemini / ローカルLLM 等）に
形成的評価を依頼するための入力パッケージ一式です。
学生1人（提出1件）あたり AiEvaluationPackage が1ファイル含まれます。
対象は本番 AI 評価候補のみです（検証用アカウント・未提出は含みません）。

【必須ファイル】
- manifest.json … バッチ一覧
- target-list.json … 固定対象リスト（Export / 外部LLM / Import で共通利用）
- packages/{evaluation_request_id}.json … 各 Package

【AIへ渡すこと】
- packages/ 配下の各 JSON（AiEvaluationPackage）を評価対象として渡してください。
- target-list.json の target_count と packages 件数が一致していることを確認してください。
- manifest.json はバッチの一覧です。Package 本体の内容ではありません。

【返却時】
- 結果は必ず manifest.json 付きの ZIP にしてください（manifest 無しは取込不可）。
- 推奨構成:
    manifest.json
    target-list.json（Export 時の同一ファイルを同梱推奨）
    results/{evaluation_request_id}.json
- manifest.kind は "ai_evaluation_import_batch" にしてください。
- 各 result の metadata.evaluation_request_id は、対応する package と一致させてください。
- target-list.json がある場合、リスト外の evaluation_request_id は取込拒否されます。
- manifest.members[].path は results/{evaluation_request_id}.json と一致させてください。

【編集禁止】
- packages/ 内の Package を改変しないでください。
- target-list.json の対象を手で増やさないでください。
- result を手編集する場合も schema を崩さないでください。
- 氏名・学籍番号・組織IDなどの再識別情報を追加しないでください。
`;

export type ZipEntryMap = Record<string, Uint8Array>;

export function zipEntriesFromObject(
  files: Record<string, string | Uint8Array>,
): Uint8Array {
  const mapped: ZipEntryMap = {};
  for (const [path, body] of Object.entries(files)) {
    const key = normalizeZipPath(path);
    mapped[key] = typeof body === "string" ? strToU8(body) : body;
  }
  return zipSync(mapped, { level: 6 });
}

export function unzipToEntries(zipBytes: Uint8Array): {
  paths: string[];
  readText: (path: string) => string | null;
  readBytes: (path: string) => Uint8Array | null;
} {
  const unzipped = unzipSync(zipBytes);
  const byPath = new Map<string, Uint8Array>();
  for (const [rawPath, data] of Object.entries(unzipped)) {
    const path = normalizeZipPath(rawPath);
    if (!path || path.endsWith("/")) continue;
    byPath.set(path, data);
  }
  return {
    paths: [...byPath.keys()].sort(),
    readText(path: string) {
      const data = byPath.get(normalizeZipPath(path));
      if (!data) return null;
      return strFromU8(data);
    },
    readBytes(path: string) {
      return byPath.get(normalizeZipPath(path)) ?? null;
    },
  };
}

/** Node Buffer / ArrayBuffer / base64 → Uint8Array */
export function toUint8Array(input: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof input === "string") {
    // base64
    const buf = Buffer.from(input, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
