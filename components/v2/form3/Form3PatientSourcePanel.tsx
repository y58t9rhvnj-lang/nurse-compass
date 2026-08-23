"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildForm3PatientSourceView,
  FORM3_PATIENT_SOURCE_SECTION_IDS,
  type Form3PatientSourceSectionId,
  type Form3PatientSourceView,
} from "@/lib/form3/v2/form3V2PatientSource";
import type { FacingConvoState } from "@/lib/patientFacingData";
import type { Patient } from "@/lib/wardData";

export type Form3PatientSourcePanelProps = {
  patientId: string;
  patient?: Patient | null;
  facing?: FacingConvoState | null;
  /** sheet 再表示時にスクロール復元するためのキー */
  restoreKey?: string | number | boolean;
  className?: string;
};

const DEFAULT_OPEN: Record<Form3PatientSourceSectionId, boolean> = {
  basics: true,
  chart: true,
  conversation: true,
  laboratory: false,
  treatment: false,
};

function storageKey(patientId: string) {
  return `compass:form3:patient-source:scroll:${patientId}`;
}

function sectionStorageKey(patientId: string) {
  return `compass:form3:patient-source:sections:${patientId}`;
}

function loadOpenState(
  patientId: string,
): Record<Form3PatientSourceSectionId, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_OPEN };
  try {
    const raw = sessionStorage.getItem(sectionStorageKey(patientId));
    if (!raw) return { ...DEFAULT_OPEN };
    const parsed = JSON.parse(raw) as Partial<
      Record<Form3PatientSourceSectionId, boolean>
    >;
    const next = { ...DEFAULT_OPEN };
    for (const id of FORM3_PATIENT_SOURCE_SECTION_IDS) {
      if (typeof parsed[id] === "boolean") next[id] = parsed[id]!;
    }
    return next;
  } catch {
    return { ...DEFAULT_OPEN };
  }
}

export default function Form3PatientSourcePanel({
  patientId,
  patient,
  facing,
  restoreKey,
  className = "",
}: Form3PatientSourcePanelProps) {
  const view: Form3PatientSourceView = useMemo(
    () =>
      buildForm3PatientSourceView({
        patientId,
        patient,
        facing,
      }),
    [patientId, patient, facing],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [openMap, setOpenMap] = useState(() => loadOpenState(patientId));

  // スクロール位置を保存
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      try {
        sessionStorage.setItem(storageKey(patientId), String(el.scrollTop));
      } catch {
        // ignore
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [patientId]);

  // マウント / Sheet 再表示でスクロール復元
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let top = 0;
    try {
      const raw = sessionStorage.getItem(storageKey(patientId));
      if (raw) top = Number(raw) || 0;
    } catch {
      top = 0;
    }
    el.scrollTop = top;
  }, [patientId, restoreKey]);

  const toggleSection = useCallback(
    (id: Form3PatientSourceSectionId) => {
      setOpenMap((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        try {
          sessionStorage.setItem(
            sectionStorageKey(patientId),
            JSON.stringify(next),
          );
        } catch {
          // ignore
        }
        return next;
      });
    },
    [patientId],
  );

  return (
    <div className={`flex h-full min-h-0 flex-col bg-[#F8F8FA] ${className}`}>
      <div className="shrink-0 border-b border-[#E5E5EA] bg-white px-4 py-4">
        <p className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
          Patient Source
        </p>
        <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-[#1D1D1F]">
          {view.patientName}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">
          一次情報の参照です。内容は転記せず、Information Card に自分の言葉で書いてください。
        </p>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        <div className="flex flex-col gap-3">
          {view.sections.map((section) => {
            const open = openMap[section.id];
            return (
              <section
                key={section.id}
                className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#E5E5EA]"
              >
                <button
                  type="button"
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={open}
                >
                  <span>
                    <span className="block text-[15px] font-semibold text-[#1D1D1F]">
                      {section.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#8E8E93]">
                      {section.description}
                    </span>
                  </span>
                  <span className="text-[18px] text-[#8E8E93]" aria-hidden>
                    {open ? "−" : "＋"}
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-[#E5E5EA] px-4 py-3">
                    {section.items.length === 0 ? (
                      <p className="py-4 text-[14px] text-[#8E8E93]">
                        表示できる記録がありません。
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {section.items.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-xl bg-[#F2F2F7] px-3 py-3"
                          >
                            <p className="text-[13px] font-semibold text-[#1D1D1F]">
                              {item.title}
                            </p>
                            {item.meta ? (
                              <p className="mt-1 text-[12px] text-[#8E8E93]">
                                {item.meta}
                              </p>
                            ) : null}
                            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#3A3A3C]">
                              {item.body}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
