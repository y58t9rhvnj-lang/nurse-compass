// 学生管理（Admin）で扱うビュー型。DB 行(snake_case)からアプリ(camelCase)へ変換した形。

export type AdminStudentListItem = {
  id: string;
  loginId: string;
  studentNumber: string | null;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

export type AdminStudentListResult = {
  items: AdminStudentListItem[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
};

export type AdminStudentDetail = {
  id: string;
  loginId: string;
  studentNumber: string | null;
  displayName: string;
  role: string;
  organizationId: string;
  organizationName: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};
