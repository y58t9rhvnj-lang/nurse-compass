/**
 * Patient A Teacher Insight → 正規カタログ安定 Information ID。
 * カタログ外情報はここに入れない（missingInformation / caution へ）。
 */

export const PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP: Readonly<
  Record<string, readonly string[]>
> = {
  "TI-A-01": [
    "a-info-activity-s-1",
    "a-info-activity-o-1",
    "a-info-sleep-s-1",
    "a-info-sleep-o-1",
  ],
  "TI-A-02": [
    "a-info-cognitive-s-1",
    "a-info-cognitive-o-1",
    "a-info-sleep-s-1",
    "a-info-sleep-o-1",
    "a-info-coping-s-1",
    "a-info-coping-o-1",
    "a-info-self-s-1",
  ],
  "TI-A-03": [
    "a-info-health-s-1",
    "a-info-health-o-1",
    "a-info-value-s-1",
    "a-info-self-s-1",
  ],
  "TI-A-04": [
    "a-info-coping-s-1",
    "a-info-self-s-1",
    "a-info-role-o-1",
    "a-info-value-s-1",
    "a-info-value-o-1",
    "a-info-health-s-1",
  ],
  "TI-A-05": [
    "a-info-role-s-1",
    "a-info-role-o-1",
    "a-info-self-o-1",
    "a-info-health-s-1",
    "a-info-value-s-1",
  ],
  "TI-A-06": [
    "a-info-health-s-1",
    "a-info-health-o-1",
    "a-info-value-s-1",
  ],
  "TI-A-07": [
    "a-info-activity-s-1",
    "a-info-activity-o-1",
    "a-info-self-s-1",
    "a-info-self-o-1",
    "a-info-cognitive-s-1",
    "a-info-cognitive-o-1",
    "a-info-role-s-1",
    "a-info-role-o-1",
  ],
};

export const PATIENT_A_KNOWN_CTP_IDS: ReadonlySet<string> = new Set([
  "CTP-01",
  "CTP-02",
  "CTP-03",
  "CTP-04",
  "CTP-05",
]);
