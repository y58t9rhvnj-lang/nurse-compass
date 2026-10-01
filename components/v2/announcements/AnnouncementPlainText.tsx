/** お知らせ本文をプレーンテキストとして安全に表示する。HTML は解釈しない。 */
export default function AnnouncementPlainText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      data-announcement-plain-text="1"
      className={`whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#1D1D1F] ${className}`}
    >
      {text}
    </p>
  );
}
