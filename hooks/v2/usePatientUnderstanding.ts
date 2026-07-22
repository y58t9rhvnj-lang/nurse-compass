"use client";

// Compass Version2 — Learning Layer (Sprint D-2C)
// 患者理解「私が捉えた患者さん」（patient_understanding_records）の Supabase 接続フック。
//
// 責務:
//   ・マウント時（患者切替時）にサーバから現行の overview を取得する（再読み込み・再ログイン後も保持）。
//   ・入力を debounce（約800ms）して自動保存する（学生 × ケースで 1 件を upsert）。
//   ・状態は「保存中 / 保存済み / 保存エラー」を控えめに表示できるよう最小限で返す。
//
// 方針（既存 useForm2Supabase の設計を踏襲・簡素化）:
//   ・Server Action は callAction 経由（通信断・reject を安全に正規化）。
//   ・busyRef で二重送信を防ぐ。保存中の編集は追随保存する。
//   ・失敗しても入力は失わない（text はローカルに保持し続ける）。
//   ・アンマウント時に保留中の保存があれば flush する（ビュー切替で未保存を失わない）。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPatientUnderstandingAction,
  savePatientUnderstandingAction,
} from "@/app/v2/actions/patientUnderstanding";
import { callAction } from "@/lib/v2/callAction";

const DEBOUNCE_MS = 800;

export type OverviewSaveStatus = "idle" | "saving" | "saved" | "error";

export interface UsePatientUnderstandingResult {
  text: string;
  status: OverviewSaveStatus;
  loaded: boolean;
  onChangeText: (next: string) => void;
}

export function usePatientUnderstanding({
  patientId,
}: {
  patientId: string;
}): UsePatientUnderstandingResult {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<OverviewSaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);

  const busyRef = useRef(false);
  const pendingRef = useRef(false); // 保存中に編集が入ったら完了後に追随保存する
  const dirtyRef = useRef(false); // 初回ロードで学生の入力を上書きしないための番人
  const latestRef = useRef(""); // 最新の入力（flush / 追随保存で参照）
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async () => {
    if (busyRef.current) {
      pendingRef.current = true;
      return;
    }
    busyRef.current = true;
    setStatus("saving");
    try {
      const res = await callAction(() =>
        savePatientUnderstandingAction({
          patientId,
          overviewText: latestRef.current,
        }),
      );
      setStatus(res.ok ? "saved" : "error");
    } finally {
      busyRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void doSave();
      }
    }
  }, [patientId]);

  // マウント時（患者切替時）に現行 overview を取得する。
  // 患者切替は本ビューの受け持ちガードで unmount/remount されるため、state 初期値（"" / idle / false）が
  // そのまま「リセット」になる。ここでは ref のみ同期的に触り、setState は async 内でのみ行う
  // （effect 本体での同期 setState による cascading renders を避ける）。学生が取得前に入力していれば上書きしない。
  useEffect(() => {
    let alive = true;
    dirtyRef.current = false;
    void (async () => {
      const res = await callAction(() => getPatientUnderstandingAction(patientId));
      if (!alive || dirtyRef.current) {
        if (alive) setLoaded(true);
        return;
      }
      if (res.ok) {
        const loadedText = res.data?.overviewText ?? "";
        setText(loadedText);
        latestRef.current = loadedText;
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [patientId]);

  const onChangeText = useCallback(
    (next: string) => {
      dirtyRef.current = true;
      latestRef.current = next;
      setText(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void doSave();
      }, DEBOUNCE_MS);
    },
    [doSave],
  );

  // アンマウント時: 保留中の自動保存があれば flush（ビュー切替が debounce より先でも失わない）。
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        if (dirtyRef.current) void doSave();
      }
    };
  }, [doSave]);

  return { text, status, loaded, onChangeText };
}
