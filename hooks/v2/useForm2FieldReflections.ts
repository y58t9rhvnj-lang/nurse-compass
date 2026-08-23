"use client";

// Compass Version2 — Learning Layer (Sprint D-3A)
// 「各項目から考えたこと」（form2_field_reflections）の Supabase 接続フック。
//
// 責務:
//   ・マウント時（患者切替時）にサーバから現行の考察一覧を取得する（再読み込み・再ログイン後も保持）。
//   ・項目ごとに入力を debounce（約800ms）して自動保存する（学生 × ケース × 項目で 1 件を upsert）。
//   ・状態は項目ごとに「保存中 / 保存済み / 保存エラー」を控えめに表示できるよう返す。
//
// 方針（既存 usePatientUnderstanding を項目複数へ拡張）:
//   ・Server Action は callAction 経由（通信断・reject を安全に正規化）。
//   ・項目ごとの busy/pending で二重送信を防ぎ、保存中の編集は追随保存する。
//   ・失敗しても入力は失わない（texts はローカルに保持し続ける）。
//   ・アンマウント時に保留中の保存があれば flush する（ビュー切替で未保存を失わない）。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listForm2FieldReflectionsAction,
  saveForm2FieldReflectionAction,
} from "@/app/v2/actions/form2FieldReflections";
import { callAction } from "@/lib/v2/callAction";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";

const DEBOUNCE_MS = 800;

export type ReflectionSaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseForm2FieldReflectionsResult {
  textOf: (key: string) => string;
  statusOf: (key: string) => ReflectionSaveStatus;
  // 読み込み済みの考察（表示可否の判定などに使う）。key -> text。
  texts: Record<string, string>;
  // 初回ロード時点で reflection が保存済みだった項目キー（表示対象の凍結に使う）。
  //   ・様式2 が後から空欄でも、この集合の項目は表示し続けて内容を失わせない。
  loadedKeys: string[];
  loaded: boolean;
  onChangeReflection: (key: string, next: string) => void;
}

export function useForm2FieldReflections({
  patientId,
}: {
  patientId: string;
}): UseForm2FieldReflectionsResult {
  const localOnly = useLectureLocalOnly();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, ReflectionSaveStatus>>(
    {},
  );
  const [loadedKeys, setLoadedKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const latestRef = useRef<Record<string, string>>({}); // key -> 最新の入力
  const busyRef = useRef<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, boolean>>({}); // 保存中に入った編集の追随保存
  const dirtyRef = useRef(false); // 初回ロードで学生の入力を上書きしないための番人
  const debounceRef = useRef<
    Record<string, ReturnType<typeof setTimeout> | null>
  >({});

  const setStatus = useCallback((key: string, s: ReflectionSaveStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: s }));
  }, []);

  const doSave = useCallback(
    async (key: string) => {
      if (localOnly) {
        setStatus(key, "saved");
        return;
      }
      if (busyRef.current[key]) {
        pendingRef.current[key] = true;
        return;
      }
      busyRef.current[key] = true;
      setStatus(key, "saving");
      try {
        const res = await callAction(() =>
          saveForm2FieldReflectionAction({
            patientId,
            fieldKey: key,
            reflectionText: latestRef.current[key] ?? "",
          }),
        );
        setStatus(key, res.ok ? "saved" : "error");
      } finally {
        busyRef.current[key] = false;
        if (pendingRef.current[key]) {
          pendingRef.current[key] = false;
          void doSave(key);
        }
      }
    },
    [patientId, setStatus, localOnly],
  );

  // マウント時（患者切替時）に現行の考察一覧を取得する。
  // 患者切替は本ビューの受け持ちガードで unmount/remount されるため、state 初期値がリセットになる。
  // ここでは ref のみ同期的に触り、setState は async 内でのみ行う（cascading renders を避ける）。
  // 学生が取得前に入力していれば上書きしない（dirtyRef）。
  useEffect(() => {
    if (localOnly) {
      setLoaded(true);
      return;
    }
    let alive = true;
    dirtyRef.current = false;
    void (async () => {
      const res = await callAction(() =>
        listForm2FieldReflectionsAction(patientId),
      );
      if (!alive || dirtyRef.current) {
        if (alive) setLoaded(true);
        return;
      }
      if (res.ok) {
        const map: Record<string, string> = {};
        for (const r of res.data) map[r.fieldKey] = r.reflectionText;
        setTexts(map);
        latestRef.current = { ...map };
        // 初回に保存済み（非空）だった項目を凍結キーとして保持する。
        setLoadedKeys(
          Object.keys(map).filter((k) => (map[k] ?? "").trim().length > 0),
        );
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [patientId, localOnly]);

  const onChangeReflection = useCallback(
    (key: string, next: string) => {
      dirtyRef.current = true;
      latestRef.current[key] = next;
      setTexts((prev) => ({ ...prev, [key]: next }));
      const existing = debounceRef.current[key];
      if (existing) clearTimeout(existing);
      debounceRef.current[key] = setTimeout(() => {
        debounceRef.current[key] = null;
        void doSave(key);
      }, DEBOUNCE_MS);
    },
    [doSave],
  );

  // アンマウント時: 保留中の自動保存があれば flush（ビュー切替が debounce より先でも失わない）。
  useEffect(() => {
    const timers = debounceRef.current;
    return () => {
      for (const key of Object.keys(timers)) {
        const t = timers[key];
        if (t) {
          clearTimeout(t);
          timers[key] = null;
          if (dirtyRef.current) void doSave(key);
        }
      }
    };
  }, [doSave]);

  const textOf = useCallback((key: string) => texts[key] ?? "", [texts]);
  const statusOf = useCallback(
    (key: string): ReflectionSaveStatus => statuses[key] ?? "idle",
    [statuses],
  );

  return { textOf, statusOf, texts, loadedKeys, loaded, onChangeReflection };
}
