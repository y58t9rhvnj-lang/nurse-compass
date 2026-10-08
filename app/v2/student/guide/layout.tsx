/**
 * 学生操作説明のスクロール容器。
 * html/body はアプリ全体で overflow:hidden のため、このルートだけで縦スクロールする。
 */
export default function StudentGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-manual-scroll-root="student"
      className="h-dvh overflow-y-auto overscroll-contain"
      style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
    >
      {children}
    </div>
  );
}
