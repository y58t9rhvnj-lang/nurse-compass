/**
 * Compass 選択UIトークン。
 * Compass Blue（#1E88E5）は「現在選択中」の現在地表示のみ。
 * Primary CTA（提出）は別扱い。未選択・二次アクションに青を使わない。
 *
 * iPad Safari 対策:
 * - button のシステム色が Tailwind の text-white を上書きすることがある
 * - color / -webkit-text-fill-color を #FFFFFF で明示する
 * - 対象要素には data-compass-selected="true" を付与（globals.css と二重防御）
 */

export const BRAND_PRIMARY = "#1E88E5";

/** 選択中（背景・白文字・semibold）— Safari 向けに fill-color も明示 */
export const BRAND_SELECTED_BG = "bg-[#1E88E5]";
export const BRAND_SELECTED_SEGMENT = [
  "bg-[#1E88E5]",
  "font-semibold",
  "text-[#FFFFFF]",
  "[color:#FFFFFF]",
  "[-webkit-text-fill-color:#FFFFFF]",
  "opacity-100",
  "transition-[background-color,color,transform] duration-150 ease-out",
  "motion-reduce:transition-none",
].join(" ");

/** Segmented Control 内の未選択（トラック上は透明） */
export const BRAND_UNSELECTED_IN_TRACK = [
  "bg-transparent",
  "font-medium",
  "text-[#344054]",
  "[color:#344054]",
  "[-webkit-text-fill-color:#344054]",
  "opacity-100",
  "hover:bg-black/[0.04]",
  "transition-[background-color,color,transform] duration-150 ease-out",
  "motion-reduce:transition-none",
].join(" ");

/** 単独ピルの未選択（診療録タブ・Pattern 等） */
export const BRAND_UNSELECTED_PILL = [
  "bg-[#F4F6F8]",
  "font-medium",
  "text-[#344054]",
  "[color:#344054]",
  "[-webkit-text-fill-color:#344054]",
  "opacity-100",
  "transition-[background-color,color,transform] duration-150 ease-out",
  "hover:bg-[#E8ECF0]",
  "motion-reduce:transition-none",
].join(" ");

/** iPadOS 風 Segmented Control トラック */
export const BRAND_SEGMENT_TRACK =
  "flex rounded-[10px] bg-[#F4F6F8] p-[3px]";

/** アイコン色（SVG は currentColor / stroke を継承） */
export const BRAND_ICON_SELECTED = [
  "shrink-0",
  "text-[#FFFFFF]",
  "[color:#FFFFFF]",
  "[-webkit-text-fill-color:#FFFFFF]",
  "opacity-100",
].join(" ");

export const BRAND_ICON_UNSELECTED = [
  "shrink-0",
  "text-[#667085]",
  "[color:#667085]",
  "[-webkit-text-fill-color:#667085]",
  "opacity-100",
].join(" ");

/** @deprecated */
export const DARK_SELECTED_BG = BRAND_SELECTED_BG;
/** @deprecated */
export const DARK_SELECTED_SEGMENT = BRAND_SELECTED_SEGMENT;
/** @deprecated */
export const DARK_UNSELECTED_IN_TRACK = BRAND_UNSELECTED_IN_TRACK;
/** @deprecated */
export const DARK_SEGMENT_TRACK = BRAND_SEGMENT_TRACK;
