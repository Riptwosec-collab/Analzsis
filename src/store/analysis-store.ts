"use client";

import { create } from "zustand";
import type { ViewId } from "@/constants/navigation";
import { createSanitizationPreview, DEFAULT_SANITIZATION_OPTIONS, type SanitizationOptions } from "@/services/sanitization/sanitizer";
import type { AnalysisResult } from "@/types/network";

export type AnalysisStatus = "idle" | "reading" | "detecting" | "parsing" | "correlating" | "scoring" | "completed" | "failed" | "cancelled";

interface AnalysisState {
  rawCliText: string;
  sanitizedCliText: string;
  result: AnalysisResult | null;
  analysisStatus: AnalysisStatus;
  progressPercent: number;
  progressMessage: string;
  activeView: ViewId;
  selectedDevice?: string;
  selectedIp?: string;
  selectedFinding?: string;
  error?: string;
  setRawCliText: (text: string) => void;
  generateSanitizedText: (options?: SanitizationOptions) => void;
  resetSanitization: () => void;
  startAnalysis: () => void;
  cancelAnalysis: () => void;
  setProgress: (status: AnalysisStatus, percent: number, message: string) => void;
  setResult: (result: AnalysisResult | null) => void;
  setError: (error: string) => void;
  setActiveView: (view: ViewId) => void;
  selectDevice: (device?: string) => void;
  selectIp: (ip?: string) => void;
  selectFinding: (finding?: string) => void;
  clearSession: () => void;
}

export const useAnalysisStore = create<AnalysisState>(set => ({
  rawCliText: "",
  sanitizedCliText: "",
  result: null,
  analysisStatus: "idle",
  progressPercent: 0,
  progressMessage: "Idle",
  activeView: "import",
  setRawCliText: rawCliText => set({ rawCliText, sanitizedCliText: "", error: undefined }),
  generateSanitizedText: (options = DEFAULT_SANITIZATION_OPTIONS) => set(state => ({ sanitizedCliText: createSanitizationPreview(state.rawCliText, options).sanitizedText })),
  resetSanitization: () => set({ sanitizedCliText: "" }),
  startAnalysis: () => set({ analysisStatus: "reading", progressPercent: 5, progressMessage: "Reading CLI", error: undefined }),
  cancelAnalysis: () => set({ analysisStatus: "cancelled", progressMessage: "Analysis cancelled" }),
  setProgress: (analysisStatus, progressPercent, progressMessage) => set({ analysisStatus, progressPercent: Math.max(0, Math.min(100, progressPercent)), progressMessage }),
  setResult: result => set({ result, analysisStatus: result ? "completed" : "idle", progressPercent: result ? 100 : 0, progressMessage: result ? "Completed" : "Idle" }),
  setError: error => set({ error, analysisStatus: "failed", progressMessage: error }),
  setActiveView: activeView => set({ activeView }),
  selectDevice: selectedDevice => set({ selectedDevice }),
  selectIp: selectedIp => set({ selectedIp }),
  selectFinding: selectedFinding => set({ selectedFinding }),
  clearSession: () => set({ rawCliText: "", sanitizedCliText: "", result: null, analysisStatus: "idle", progressPercent: 0, progressMessage: "Idle", selectedDevice: undefined, selectedIp: undefined, selectedFinding: undefined, error: undefined })
}));
