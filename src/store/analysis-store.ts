"use client";

import { create } from "zustand";
import type { AnalysisResult } from "@/types/network";

interface AnalysisState {
  cliText: string;
  result: AnalysisResult | null;
  progress: string;
  setCliText: (text: string) => void;
  setResult: (result: AnalysisResult | null) => void;
  setProgress: (progress: string) => void;
  clear: () => void;
}

export const useAnalysisStore = create<AnalysisState>(set => ({
  cliText: "",
  result: null,
  progress: "Idle",
  setCliText: cliText => set({ cliText }),
  setResult: result => set({ result, progress: result ? "Completed" : "Idle" }),
  setProgress: progress => set({ progress }),
  clear: () => set({ cliText: "", result: null, progress: "Idle" })
}));
