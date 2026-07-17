// Compass Version2 β — Phase 3-2
// V1 の患者ID（例 "A"）と、DB の教育ケースID case_id（例 "SP-001"）の対応を
// サーバ側の固定表として一元管理する。
//
// 重要:
//   ・case_id はクライアントの申告値を信用せず、必ずこの表から解決する。
//   ・未知の患者IDは null を返し、呼び出し側で validation として拒否する。
//   ・将来ケースが増える場合はこの表のみを拡張する（単一責務）。

// 患者ID → 教育ケースID。現状は受け持ち対象（患者A）のみ。
const PATIENT_TO_CASE_ID: Readonly<Record<string, string>> = {
  A: "SP-001",
};

// 検証済みの患者IDから case_id を解決する。未知IDは null。
export function caseIdForPatient(patientId: string): string | null {
  if (typeof patientId !== "string") return null;
  return PATIENT_TO_CASE_ID[patientId] ?? null;
}

// この患者IDが保存対象（既知ケース）かどうか。
export function isKnownPatient(patientId: string): boolean {
  return caseIdForPatient(patientId) !== null;
}
