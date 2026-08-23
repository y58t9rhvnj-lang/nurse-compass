import type { Viewport } from "next";

/**
 * 講義ルートのみ Safari 標準ピンチズームを許可する。
 * ルート layout の userScalable:false を上書きし、/v2/student 等には影響しない。
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function TeacherLectureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
