// 監査ログの action / target_type 定数と型。
//
// 文字列の直書きを避け、記録側・（将来の）閲覧側で同じ語彙を共有する。
// 秘密情報を扱わない純粋な定数のみ（"server-only" は付けない）。
// D-3 で予定している管理者操作に限定し、過剰に増やさない。

export const ADMIN_AUDIT_ACTIONS = {
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DEACTIVATE: "user.deactivate",
  USER_REACTIVATE: "user.reactivate",
  PASSWORD_RESET: "user.password_reset",
  CSV_IMPORT: "user.csv_import",
} as const;

export const ADMIN_AUDIT_TARGET_TYPES = {
  USER: "user",
  CSV_IMPORT: "csv_import",
  SYSTEM: "system",
} as const;

export type AdminAuditAction =
  (typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

export type AdminAuditTargetType =
  (typeof ADMIN_AUDIT_TARGET_TYPES)[keyof typeof ADMIN_AUDIT_TARGET_TYPES];
