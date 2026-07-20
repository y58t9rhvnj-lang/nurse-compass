"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import OutsideWardArea from "@/components/OutsideWardArea";
import SideNav, {
  STUDENT_NAV_ITEMS,
  type AppView,
  type SideNavIdentity,
} from "@/components/SideNav";
import Notice from "@/components/Notice";
import CoreLayer from "@/components/v2/core/CoreLayer";
import LearningLayer from "@/components/v2/learning/LearningLayer";
import { isLearningWorkspaceView } from "@/components/v2/learning/workspace/WorkspaceHost";
import {
  EvidenceCaptureProvider,
  type EvidenceCaptureApi,
} from "@/components/v2/capture/EvidenceCaptureContext";
import { NotesProvider } from "@/components/v2/notebook/NotesContext";
import { useEvidenceSupabase } from "@/hooks/v2/useEvidenceSupabase";
import { useNotesSupabase } from "@/hooks/v2/useNotesSupabase";
import type { StudentNoteRecord } from "@/lib/v2/notebook/studentNoteMapper";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { InformationCard } from "@/lib/information/informationCard";
import { useWorkspaceInspector } from "@/hooks/v2/useWorkspaceInspector";
import { useQuestionPanel } from "@/hooks/v2/useQuestionPanel";
import { getQuestionsForCase } from "@/lib/v2/question/questionFixtures";
import WorkspaceInspector from "@/components/v2/workspace/inspector/WorkspaceInspector";
import WorkspaceInspectorToggle from "@/components/v2/workspace/inspector/WorkspaceInspectorToggle";
import LearningInspectorTabs from "@/components/v2/learning/inspector/LearningInspectorTabs";
import WardMap from "@/components/WardMap";
import WardRightPanel from "@/components/WardRightPanel";
import WardHomeTopBar from "@/components/ward/WardHomeTopBar";
import CompassChart from "@/components/chart/CompassChart";
import ChartAside from "@/components/chart/ChartAside";
import ChartSideNav from "@/components/chart/ChartSideNav";
import FacingPatient from "@/components/patient/facing/FacingPatient";
import FacingCoachPanel from "@/components/patient/facing/FacingCoachPanel";
import FirstAssignmentSheet from "@/components/patient/FirstAssignmentSheet";
import NoteZone from "@/components/patient/notes/NoteZone";
import ClinicalThinkingWorkspace from "@/components/thinking-workspace/ClinicalThinkingWorkspace";
import Form2Workspace from "@/components/form2/Form2Workspace";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus } from "@/lib/chartNav";
import {
  type FacingConvoState,
  initialFacingState,
} from "@/lib/patientFacingData";
import { DEFAULT_PATIENT_ID, PATIENTS } from "@/lib/wardData";
import { isFeatureEnabled } from "@/lib/featureFlags";

// 第1回講義では情報整理ノートを学生ナビから隠す（コードは保持）。
const NOTEBOOK_ENABLED = isFeatureEnabled("informationNotebook");
// Version2「精神様式2」ワークスペース。Version1 本番では false（非表示）。
const FORM2_ENABLED = isFeatureEnabled("form2Workspace");

// Compass の問い → 気づきメモへの誘導用。token でクリック毎に再フォーカス/スクロールを発火させる。
type PendingQuestion = { text: string; token: number };

// 共通 AppShell の動作モード。V1（`/`・無認証・現行挙動）と
// V2（`/v2/student`・学生認証・受け持ち固定）を同一シェルで切り替える。
// 【移行注記】mode は Architecture 移行（Core / Learning Layer / Integration）の
// 途上で残す互換用フラグ。恒久設計では learningLayer 有効/無効へ寄せる（docs/architecture/03）。
export type AppShellMode = "v1" | "v2";

// ── Learning Layer 接続点（概念モデル） ────────────────────────────────
// Compass Architecture の Integration 契約（docs/architecture/03 §3）に基づく
// AppShell と Learning Layer の唯一の結合点。Core（臨床世界）は learningLayer
// 無しで単独成立し（Core Independence）、learningLayer 有効時のみ学習能力を
// 「加算・重畳」する。今回（Architecture Sprint 1-1）は型と入口の追加のみで、
// 描画・状態・挙動には一切接続しない（UI は 1px も変えない）。
// 詳細な将来モデルは docs/architecture/02_learning_layer.md の LearningLayerConfig。
export interface LearningLayerConfig {
  // 学習能力全体の有効化。false / 未指定なら素の Core（現行 "/" と同一）。
  enabled: boolean;
  // 学習者ロール。保存先と利用可能機能の判定に使う（UI をロール別に置換しない）。
  role?: "student" | "teacher";
  // サイドバー等に表示する学習者識別（Core の看護師既定を置き換えるためではない）。
  identity?: SideNavIdentity;
  // 学習者 id（profiles.id）。学習データ保存・患者文脈判定に使う。
  userId?: string;
  // ── 将来拡張（Sprint 1-2 以降で段階的に接続。今回は未使用） ──────────
  // 学習開始文脈（恒久的な初期 state 決定 API）。将来 resolveInitialAppView /
  // resolveInitialPatientId が mode/fixedPatientId ではなく本設定を参照する。
  // initialContext?: { view?: AppView; patientId?: string };
  // capabilities?: {
  //   form2: boolean;       // 様式2（Supabase 版）
  //   inspector: boolean;   // 学習支援 Inspector（overlay）
  //   question: boolean;    // Question パネル
  //   evidence: boolean;    // Evidence 収集・整理
  //   reflection: boolean;  // 振り返り（将来）
  //   story: boolean;       // Patient Story（将来）
  // };
  // form2?: { enabled: boolean; initial: Form2Snapshot | null };
  // inspector?: { enabled: boolean };
  // persistence?: { provider: "supabase" };
}

export interface AppShellProps {
  // 既定 "v1"。`/` は無引数（<AppShell />）で従来どおり。
  mode?: AppShellMode;
  // V2 の Supabase 保存に使う学生 id（profiles.id）。V2 様式2 の描画・保存に必須。
  userId?: string;
  // V2 様式2 の初期スナップショット（server page が Repository から取得して注入）。
  // V1 既定は undefined（V1 分岐では未使用）。
  initialForm2?: Form2Snapshot | null;
  // サイドバー識別情報。既定は看護師プロフィール（V1）。V2 は学生本人。
  identity?: SideNavIdentity;
  // V2 の受け持ち対象固定（例 "A"）。指定時は病棟マップ選択を出さない。
  fixedPatientId?: string;
  // 学習支援 Inspector の有効化。既定 false。P4 で描画に接続する。
  inspectorEnabled?: boolean;
  // V2 思考ワークスペースの初期 Evidence（server page が Repository から取得して注入）。
  // V1 既定は undefined（V1 分岐では未使用）。Architecture Sprint 5。
  initialEvidence?: InformationCard[];
  // V2 Compassメモ の初期データ（server page が受け持ち患者の active notes を取得して注入）。
  // StudentNoteRecord[]（note: UI向け / updatedAt: 楽観ロック用の生 ISO）。V1 既定は undefined。
  initialNotes?: StudentNoteRecord[];
  // ── Learning Layer 接続点（Architecture Sprint 1-1 で追加した「入口」） ──
  // 恒久設計上の唯一の結合点。今回は型として受け入れるのみで、内部では未使用
  // （destructure しない）。Sprint 1-2 以降で mode 依存を段階的に置き換えていく。
  learningLayer?: LearningLayerConfig;
}

// ── Core 標準初期状態（Core 側の規則で決定。Learning Layer 非依存） ────────
// Compass Core の初期 view は常に病棟ホーム。初期患者は DEFAULT_PATIENT_ID。
// これらが Core の「標準初期値」であり、mode / learningLayer に依存しない。
const CORE_INITIAL_VIEW: AppView = "ward";

// Core（電子カルテ・患者との会話）からの直接 Evidence 収集（「Workspaceへ追加」）の有効/無効。
// 学生は Compassメモ に自分の言葉で記録し、Evidence の整理は思考ワークスペース内で行う設計へ移行中のため、
// 現在は無効（false）＝ EvidenceCaptureProvider へ null を渡し、各収集ボタンを一切描画しない。
// collectSource / EvidenceCaptureButton 等のコードは削除せず残す（将来の再有効化に備える）。
const CORE_CAPTURE_ENABLED = false;

// 初期 activeView の解決（純粋・副作用なし・JSX/handler から独立）。
// Lecture Readiness – Core Entry Flow:
//   V1・V2 いずれもログイン/起動直後は Core の「病棟案内」から開始する。
//   学生に「Learning Layer を起点にする」のではなく「Core の上で Learning Layer を利用する」
//   体験をさせるため、初期地点を Learning（思考ワークスペース・様式2）にしない。
// 恒久設計では learningLayer 側の明示設定（将来の initialContext.view）で与える。
function resolveInitialAppView(): AppView {
  return CORE_INITIAL_VIEW; // 常に病棟案内（"ward"）から開始
}

// 初期 selectedId（患者）の解決（純粋・副作用なし）。
// 恒久設計では learningLayer 側の受け持ち対象（将来の initialContext.patientId）で与える。
// TODO(Architecture Migration / Priority A→B): 現行互換のため fixedPatientId を参照している。
//   Priority B 以降で learningLayer 設定へ置換し、この参照を除去する。
//   Core の標準初期患者は DEFAULT_PATIENT_ID。
function resolveInitialPatientId(fixedPatientId: string | undefined): string {
  // 互換: Learning Layer の受け持ち対象（現状は fixedPatientId）を優先。
  return fixedPatientId ?? DEFAULT_PATIENT_ID;
}

// ══════════════════════════════════════════════════════════════════════
// Compass AppShell = Core Shell（臨床世界のシェル）
// ----------------------------------------------------------------------
// 設計思想（docs/architecture/01–03）:
//   ・このコンポーネントは Compass Core（臨床世界）のシェルである。
//   ・Learning Layer（学習支援能力）は Core を「置換」せず「加算・重畳」される。
//   ・恒久設計の唯一の結合点は props.learningLayer（Sprint 1-1 で入口のみ追加済み）。
// 移行状況（Architecture Migration）:
//   ・現状は mode / mode==="v2" 早期return が学習導線を暫定的に担う「別シェル」。
//   ・Sprint 1-2（本回）は「責務の分離マーキング（コメント）」のみ。mode は削除しない。
//   ・以降の Sprint で mode 依存を learningLayer 駆動へ段階移行する。
//
// ── mode 依存 削除ロードマップ（Sprint 1-2 で確定・コード未変更） ──────────
//   Priority A: mode 由来の初期 state 分岐
//               （activeView 初期値 / fixedPatientId 由来の selectedId 初期値）
//   Priority B: mode==="v2" 早期 return ブロックそのもの（別シェルの廃止）
//   Priority C: showInspector 内の `mode === "v2"` 判定 → learningLayer.inspector へ
//   Priority D: handleSideNav 内の `|| mode === "v2"` 導線ゲート → Learning Navigation へ
//   Priority E: data-shell-mode / data-inspector-enabled 等の暫定マーカー除去
//   ※各 Priority は Core 回帰 QA（`/` が 1px も変わらない）を満たしてから次へ進む。
// ══════════════════════════════════════════════════════════════════════
export default function AppShell({
  mode = "v1",
  userId,
  identity,
  fixedPatientId,
  inspectorEnabled = false,
  initialForm2,
  initialEvidence,
  initialNotes,
}: AppShellProps = {}) {
  // Core 標準初期値を Core の規則で決定してから useState へ渡す（Priority A）。
  // useState 内には mode / fixedPatientId を直接書かない（初期状態決定を隔離）。
  const initialAppView = resolveInitialAppView();
  const initialPatientId = resolveInitialPatientId(fixedPatientId);
  const [activeView, setActiveView] = useState<AppView>(initialAppView);
  const [selectedId, setSelectedId] = useState<string>(initialPatientId);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(
    null,
  );
  // 患者画面の Compass Coach 導線から開いたときの電子カルテ初期タブ／フォーカス。
  const [chartInitialTab, setChartInitialTab] = useState<ChartTabId | undefined>(
    undefined,
  );
  const [chartInitialFocus, setChartInitialFocus] = useState<
    ChartFocus | undefined
  >(undefined);
  // 「患者と向き合う」会話状態を患者別に保持。カルテ往復しても維持し、患者ごとに独立。
  const [facingConvos, setFacingConvos] = useState<
    Record<string, FacingConvoState>
  >({});

  const selectedPatient = PATIENTS[selectedId];
  const facingState = facingConvos[selectedId] ?? initialFacingState();
  const setFacingState = (next: FacingConvoState) =>
    setFacingConvos((prev) => ({ ...prev, [selectedId]: next }));

  const goPatientTop = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("patient");
  };
  const goWard = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("ward");
  };
  // 情報整理ノート（Clinical Thinking Workspace）。現在の患者を保持したまま遷移する。
  const goWorkspace = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("workspace");
  };
  // Version2「精神様式2」を開く（flag 有効時のみ導線から到達）。
  const goForm2 = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("form2");
  };
  // V2: 受け持ち対象の入口（患者トップ）。
  const goPatientOverview = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("patient-top");
  };
  // V2: 患者との会話（V1 の FacingPatient を再利用）。
  const goConversation = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("conversation");
  };
  // V2: 思考ワークスペース（Clinical Thinking Workspace / Architecture Sprint 5）。
  const goClinicalWorkspace = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("clinical-workspace");
  };
  // 電子カルテを開く。tab 指定時はそのタブから、focus 指定時は該当記録へ移動・強調。
  const goChart = (tab?: ChartTabId, focus?: ChartFocus) => {
    setNotice(null);
    setChartInitialTab(tab);
    setChartInitialFocus(focus);
    setActiveView("chart");
  };
  // 患者切替時は誘導中の問いをクリア
  const selectPatient = (id: string) => {
    setSelectedId(id);
    setPendingQuestion(null);
  };
  const useQuestionForNote = (text: string) => {
    setPendingQuestion({ text, token: Date.now() });
  };
  const clearPendingQuestion = () => setPendingQuestion(null);
  const handleSideNav = (view: AppView) => {
    if (view === "ward") goWard();
    else if (view === "patient") goPatientTop();
    else if (view === "patient-top") goPatientOverview();
    else if (view === "conversation") goConversation();
    else if (view === "clinical-workspace") goClinicalWorkspace();
    else if (view === "chart") goChart();
    else if (view === "workspace" && NOTEBOOK_ENABLED) goWorkspace();
    // 様式2 は V1 では flag 依存、V2 では常に到達可能（flag は変更しない）。
    else if (view === "form2" && (FORM2_ENABLED || mode === "v2")) goForm2();
  };

  // ── Version2 学習支援 Inspector（P4） ───────────────────────────
  // Hooks は条件分岐せず常にトップレベルで呼ぶ（V1 でも生成されるが未描画）。
  // Inspector 開閉 state と Question 選択/状態は AppShell 直下で保持し、
  // 開閉してもメイン画面（電子カルテ・会話・様式2）を再マウントしない。
  // 様式2 Workspace の Learning Inspector は Coach / Compass Note のタブ構成。
  // 既定タブは Coach。activePanel を「アクティブタブ」として保持し、開閉・ビュー切替で失わない。
  const inspector = useWorkspaceInspector("coach");
  const inspectorTab: "coach" | "compassNote" =
    inspector.activePanel === "compassNote" ? "compassNote" : "coach";
  const questions = getQuestionsForCase();
  const questionPanel = useQuestionPanel();

  // ── Version2 Evidence コントローラ（Architecture Sprint 6） ─────────────
  // Core 収集導線（電子カルテ・会話）と思考ワークスペース左ペインが「同一の Evidence store」を
  // 共有できるよう、既存 useEvidenceSupabase を AppShell へ 1 段持ち上げる（患者文脈と同じ層）。
  // これにより、Core で収集した Evidence がページ全体の再読み込みなしにワークスペースへ反映され、
  // 収集ダイアログ／Inspector の開閉で Core 本体を再マウントしない。
  // Hooks は条件分岐せず常に呼ぶ（V1 でも生成されるが、Provider を設置しないため未使用）。
  const evidence = useEvidenceSupabase({
    patientId: selectedId,
    initial: initialEvidence ?? [],
  });
  // 各 Core 収集ボタンへ配る最小 API。cards 変化で isCollectedBySource が変わり、
  // 「保存済み」表示が自動更新される。V1（Provider 無し）では配られない。
  // 現在は Core からの直接 Evidence 収集（電子カルテ・会話の「Workspaceへ追加」）を無効化しており、
  // Provider へ null を渡すため各収集ボタンは何も描画しない（useEvidenceCapture() が null）。
  // API 実装・collectSource は削除せず残す（Compassメモ経由の整理へ一本化するための一時的な非表示）。
  const captureApi: EvidenceCaptureApi = useMemo(
    () => ({
      status: evidence.status,
      isCollected: evidence.isCollectedBySource,
      collect: evidence.collectSource,
    }),
    [evidence.status, evidence.isCollectedBySource, evidence.collectSource],
  );

  // ── Version2 Compassメモ コントローラ（Compass Memo Supabase Integration Phase 2） ────
  // Compassメモ（student_notes）を Supabase で保持するフックを AppShell で 1 度だけ生成し、
  // NotesProvider で V2 サブツリー全体へ配る。患者トップ・患者との会話の NoteZone・
  // 思考ワークスペースの EvidencePane が同一インスタンスを共有し、リロード無しで相互反映される
  // （従来 localStorage singleton が担っていた自動共有を Supabase 版で再現）。
  // Learning Layer と同様、Compassメモ は受け持ち患者のみが対象のため、可変の selectedId ではなく
  // 安定した受け持ち患者id（= initialPatientId）へスコープする。initialNotes も受け持ち患者の分。
  // Hooks は条件分岐せず常に呼ぶ（V1 でも生成されるが、Provider を設置しないため未使用）。
  // 注記: consumer（NoteZone / EvidencePane）の実接続は Phase 3。本 Phase は状態基盤のみ。
  const notes = useNotesSupabase({
    patientId: initialPatientId,
    initial: initialNotes ?? [],
  });

  // ── Version2 様式2 セッション snapshot（Lecture Readiness Sprint 1 / 表示巻き戻り修正）──
  // 様式2 コンポーネント（単独様式2 / ワークスペース右ペイン）はビュー切替で unmount/remount され、
  // useForm2Supabase は mount 時の initial からのみ state を初期化する（DB 再取得はしない）。
  // そのため保存済みでもページロード時の古い initialForm2 に巻き戻って「消えたように見える」。
  //
  // 対策: 保存成功時にサーバ確定スナップショットを患者単位でここに保持し、再マウント時の initial に
  // 優先利用する。単独様式2 と右ペインは同一の最新 state を共有する。保存の正本は Supabase のままで、
  // ページ再読み込み・再ログイン後はサーバ値（initialForm2）を使う（DB 複製・強制 reload・polling はしない）。
  const [form2Sessions, setForm2Sessions] = useState<
    Record<string, Form2Snapshot>
  >({});
  const handleForm2Persisted = useCallback(
    (snapshot: Form2Snapshot) => {
      // 保存を発行した患者（現在の selectedId）に紐付ける。別患者データと混ざらない。
      setForm2Sessions((prev) => ({ ...prev, [selectedId]: snapshot }));
    },
    [selectedId],
  );
  // 再マウント時の initial: 同一セッションの保存済みスナップショット優先・無ければサーバ値。
  const effectiveForm2 = form2Sessions[selectedId] ?? initialForm2 ?? null;

  // ── Learning Layer 対象患者ガード（受入確認で発見した不整合の修正） ──────────
  // 現段階の Version2 では、Learning Layer（思考ワークスペース・Evidence・様式2）は
  // ログイン学生の「受け持ち患者」のみを対象とする。他患者を選択中に Learning 画面へ
  // 進んでも、受け持ち患者（例: A / case SP-001）の Evidence・様式2 を表示・編集させない
  // （同一画面内で患者情報が不一致になるのを防ぐ）。他患者は Core（病棟ホーム・患者トップ・
  // 電子カルテ・患者との会話）だけを従来どおり閲覧できる。
  //
  // 判定は 1 か所に集約する:「受け持ち患者id（= V2 初期患者 = fixedPatientId）」と
  // 「現在選択中の患者id」の一致のみ。新たな patient/case id は定義しない
  //（初期患者の解決は resolveInitialPatientId で既に済み。initialPatientId を再利用）。
  const learningTargetPatientId = initialPatientId;
  const isLearningTargetSelected = selectedId === learningTargetPatientId;
  // 「受け持ち患者に戻る」: 受け持ち患者を選択状態にする。activeView は保持し、
  // selectedId が受け持ちへ戻ることでガードが解け、現在の Learning ビュー
  //（思考ワークスペース / 様式2）が受け持ち患者の実データで安全に描画される。
  const backToLearningTarget = () => {
    selectPatient(learningTargetPatientId);
  };

  // フォーカス復帰用: トリガーボタンの ref。Close/Esc/背景タップで閉じたら
  // トリガーへ戻す（preventScroll でスクロール位置を動かさない）。
  const inspectorTriggerRef = useRef<HTMLButtonElement>(null);
  const handleInspectorClose = useCallback(() => {
    inspector.close();
    window.setTimeout(
      () => inspectorTriggerRef.current?.focus({ preventScroll: true }),
      0,
    );
  }, [inspector]);
  // Inspector（学習支援）は Learning Layer 画面のみに重畳する。
  // Core 画面（電子カルテ・会話）は V1 のまま（各々の右ペイン＝ChartAside / Compassメモ）を維持し、
  // 学習支援は「思考ワークスペース・様式2」でのみ出す（V1 のシンプルさを保つ）。
  const inspectorTargetView =
    activeView === "form2" || activeView === "clinical-workspace";
  const showInspector = mode === "v2" && inspectorEnabled && inspectorTargetView;

  // ── Version2 学生シェル = V1 Core シェル + Learning 重畳 ─────────────────
  // Lecture Readiness: V2 は V1 とは別アプリではない。V1 の Core 画面・レイアウト
  //（病棟ホーム 3 カラム / 電子カルテ ChartSideNav+ChartAside / 患者との会話+Compassメモ /
  //  患者トップ）をそのまま基盤に、V2 では以下だけを「加算・重畳」する:
  //   ① ログイン/認証（ルート側で担保） ② Supabase 保存・復元（様式2・Evidence）
  //   ③ 思考ワークスペース（Learning Layer）。
  // 学生導線: ログイン → 病棟ホーム → 患者トップ → 電子カルテ・患者との会話
  //   → Compassメモ → 思考ワークスペース → Evidence 整理 → 様式2。
  // V1（mode!=="v2"）の描画は下の通常 return が担い、一切変更しない。
  if (mode === "v2") {
    // 学習支援トグル/オーバーレイ（Learning 画面＝思考ワークスペース・様式2 のみ・V2 のみ）。
    const inspectorHeader = showInspector ? (
      <div className="no-print flex shrink-0 items-center justify-end border-b border-[#E5E5EA] bg-white px-4 py-2">
        <WorkspaceInspectorToggle
          ref={inspectorTriggerRef}
          open={inspector.open}
          // 引数なし: 前回のアクティブタブ（activePanel）を保ったまま開閉する。
          onToggle={() => inspector.toggle()}
        />
      </div>
    ) : null;
    const inspectorOverlay =
      showInspector && inspector.open ? (
        <WorkspaceInspector
          title="学習支援"
          onClose={handleInspectorClose}
          widthClassName={inspector.widthClassName}
        >
          <LearningInspectorTabs
            activeTab={inspectorTab}
            onTabChange={inspector.openPanel}
            questions={questions}
            questionController={questionPanel}
            patientId={selectedId}
          />
        </WorkspaceInspector>
      ) : null;
    // 学生用フル SideNav（V1 ベースの項目＋思考ワークスペース＋学生識別）。
    const studentSideNav = (
      <aside className="w-[204px] shrink-0 border-r border-[#E5E5EA] bg-white">
        <SideNav
          activeView={activeView}
          onNavigate={handleSideNav}
          items={STUDENT_NAV_ITEMS}
          identity={identity}
        />
      </aside>
    );
    return (
      <EvidenceCaptureProvider value={CORE_CAPTURE_ENABLED ? captureApi : null}>
        <NotesProvider value={notes}>
        <div
          data-shell-mode="v2"
          data-inspector-enabled={inspectorEnabled ? "1" : undefined}
          className="flex h-dvh w-full flex-col overflow-hidden bg-[#EDEDF0] text-[#1D1D1F]"
        >
          <div className="flex min-h-0 flex-1">
            {isLearningWorkspaceView(activeView) ? (
              // Learning Layer（思考ワークスペース / 様式2）＋ Learning Inspector 重畳。
              // Workspace 本体は WorkspaceHost が種別ごとに差し替える（将来 Form3 / Related Map）。
              <LearningLayer
                view={activeView}
                sideNav={studentSideNav}
                notice={notice}
                onCloseNotice={() => setNotice(null)}
                inspectorHeader={inspectorHeader}
                inspectorOverlay={inspectorOverlay}
                isTargetPatient={isLearningTargetSelected}
                onBackToTarget={backToLearningTarget}
                userId={userId}
                patient={selectedPatient}
                initialForm2={effectiveForm2}
                onForm2Persisted={handleForm2Persisted}
                onOpenChart={goChart}
                onOpenConversation={goConversation}
              />
            ) : (
              // Core Layer（病棟ホーム / 患者トップ / 電子カルテ / 患者との会話）。学習支援は持たない。
              <CoreLayer
                activeView={activeView}
                sideNav={studentSideNav}
                notice={notice}
                onNotice={setNotice}
                onCloseNotice={() => setNotice(null)}
                selectedPatient={selectedPatient}
                selectedId={selectedId}
                pendingQuestion={pendingQuestion}
                onClearPendingQuestion={clearPendingQuestion}
                onUseQuestion={useQuestionForNote}
                chartInitialTab={chartInitialTab}
                chartInitialFocus={chartInitialFocus}
                facingState={facingState}
                onChangeFacingState={setFacingState}
                onBackToPatientTop={goPatientOverview}
                onOpenChart={goChart}
                onOpenConversation={goConversation}
                onOpenForm2={goForm2}
                onSelectPatientToTop={(id) => {
                  selectPatient(id);
                  goPatientOverview();
                }}
              />
            )}
          </div>
        </div>
        </NotesProvider>
      </EvidenceCaptureProvider>
    );
  }
  // ────────────────────────────────────────────────────────────────

  // ══ Core Shell（臨床世界の描画責務） ═══════════════════════════════
  // ここから下は Compass Core（docs/architecture/01）の描画に徹する:
  //   Ward / WardMap / Patient Top / Electronic Chart(+ChartSideNav/ChartAside) /
  //   Conversation(FacingPatient) / Notes(NoteZone) / Compass Coach / Core Navigation。
  // Core は learningLayer なしで単独成立する（Core Independence / Rule 1）。
  //
  // 【Learning Layer 接続点（将来）】docs/architecture/03 の Integration 契約に従い、
  //   恒久設計では learningLayer 有効時にこの Core 描画へ overlay / Inspector /
  //   Supabase 様式2 等を「加算・重畳」する（Core の列構成・状態は置換しない）。
  //   現状その学習重畳は上の mode==="v2" ブロックが担っており、Sprint 1-2 以降で
  //   learningLayer 駆動へ移行する。本 Sprint 1-1 では描画・状態・UI を一切変更しない。
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#EDEDF0] text-[#1D1D1F]">
      <div className="flex min-h-0 flex-1">
        {activeView === "chart" ? (
          <>
            {/* 電子カルテ専用左メニュー */}
            <aside className="w-[168px] shrink-0 border-r border-[#E5E5EA]">
              <ChartSideNav
                onBackToCompass={goPatientTop}
                onMenuSelect={(item) => {
                  if (item !== "カルテ画面") {
                    setNotice(
                      `「${item}」は準備中です。情報は上部のタブから確認できます。`,
                    );
                  }
                }}
              />
            </aside>

            {/* 電子カルテ中央 */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {notice && (
                <div className="shrink-0 px-3 pt-2">
                  <Notice text={notice} onClose={() => setNotice(null)} />
                </div>
              )}
              <div className="flex min-h-0 flex-1 flex-col">
                <CompassChart
                  patient={selectedPatient}
                  initialTab={chartInitialTab}
                  initialFocus={chartInitialFocus}
                />
              </div>
            </main>

            {/* 右ペイン（補助） */}
            <aside className="w-[240px] shrink-0 border-l border-[#E5E5EA] bg-white">
              <ChartAside
                patient={selectedPatient}
                pendingQuestion={pendingQuestion}
                onClearPendingQuestion={clearPendingQuestion}
                onUseQuestion={useQuestionForNote}
              />
            </aside>
          </>
        ) : activeView === "workspace" ? (
          <>
            {/* 通常 Compass 左サイドバー */}
            <aside className="w-[204px] shrink-0 border-r border-[#E5E5EA] bg-white">
              <SideNav activeView={activeView} onNavigate={handleSideNav} />
            </aside>

            {/* 情報整理ノート（3領域は Workspace 内で構成） */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <ClinicalThinkingWorkspace
                patient={selectedPatient}
                onBack={goPatientTop}
              />
            </main>
          </>
        ) : activeView === "form2" ? (
          <>
            {/* 通常 Compass 左サイドバー */}
            <aside className="w-[204px] shrink-0 border-r border-[#E5E5EA] bg-white">
              <SideNav activeView={activeView} onNavigate={handleSideNav} />
            </aside>

            {/* Version2「精神様式2 受け持ち対象記録」 */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Form2Workspace
                patient={selectedPatient}
                onExit={goPatientTop}
                onOpenConversation={goPatientTop}
                onOpenChart={(tab) => goChart(tab)}
              />
            </main>
          </>
        ) : (
          <>
            {/* 通常 Compass 左サイドバー */}
            <aside className="w-[204px] shrink-0 border-r border-[#E5E5EA] bg-white">
              <SideNav activeView={activeView} onNavigate={handleSideNav} />
            </aside>

            {/* 中央メイン */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {activeView === "ward" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3.5">
                  {notice && (
                    <Notice text={notice} onClose={() => setNotice(null)} />
                  )}
                  <WardHomeTopBar />
                  <WardMap
                    selectedId={selectedId}
                    onSelectPatient={selectPatient}
                  />
                  <OutsideWardArea />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {notice && (
                    <div className="px-5 pt-3">
                      <Notice text={notice} onClose={() => setNotice(null)} />
                    </div>
                  )}
                  <div className="min-h-0 flex-1">
                    <FacingPatient
                      patient={selectedPatient}
                      onBack={goWard}
                      state={facingState}
                      onChange={setFacingState}
                      onOpenWorkspace={NOTEBOOK_ENABLED ? goWorkspace : undefined}
                    />
                  </div>
                  {/* 受け持ち患者を初めて開いたときの課題シート（一度だけ・端末に永続化） */}
                  <FirstAssignmentSheet patientId={selectedId} />
                </div>
              )}
            </main>

            {/* 右ペイン（288px） */}
            <aside className="w-[288px] shrink-0 border-l border-[#E5E5EA] bg-white">
              {activeView === "ward" ? (
                <WardRightPanel
                  patient={selectedPatient}
                  onPatientTopRequest={goPatientTop}
                />
              ) : (
                // Sprint10.8A（修正）: 主役は NoteZone（情報整理ノートの前身）。
                // Compass Coach はその下にコンパクトな補助ウィジェットとして配置する。
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <NoteZone patientId={selectedId} />
                  </div>
                  <div className="shrink-0">
                    <FacingCoachPanel
                      patient={selectedPatient}
                      state={facingState}
                      onChange={setFacingState}
                      onOpenChart={goChart}
                    />
                  </div>
                </div>
              )}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
