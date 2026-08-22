/**
 * CTP → 症例カタログ安定 Information ID の明示対応。
 * 推測でカードを新設せず、既存 active 22件カタログのみを参照する。
 */

export const PATIENT_A_CTP_EVIDENCE_MAP: Readonly<
  Record<string, readonly string[]>
> = {
  "CTP-01": [
    "a-info-activity-s-1",
    "a-info-activity-o-1",
    "a-info-sleep-s-1",
    "a-info-sleep-o-1",
  ],
  "CTP-02": [
    "a-info-cognitive-s-1",
    "a-info-cognitive-o-1",
    "a-info-sleep-s-1",
    "a-info-sleep-o-1",
    "a-info-coping-s-1",
    "a-info-coping-o-1",
    "a-info-self-s-1",
  ],
  "CTP-03": [
    "a-info-coping-s-1",
    "a-info-self-s-1",
    "a-info-role-o-1",
    "a-info-value-o-1",
    "a-info-health-s-1",
  ],
  "CTP-04": [
    "a-info-self-o-1",
    "a-info-role-s-1",
    "a-info-role-o-1",
    "a-info-health-s-1",
  ],
  "CTP-05": [
    "a-info-health-o-1",
    "a-info-elimination-s-1",
    "a-info-nutrition-s-1",
    "a-info-nutrition-o-1",
    "a-info-coping-s-1",
    "a-info-sleep-o-1",
    "a-info-activity-o-1",
    "a-info-coping-o-1",
    "a-info-value-s-1",
  ],
};
