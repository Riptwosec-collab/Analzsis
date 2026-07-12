import type { ConfidenceBreakdown, Evidence } from "@/types/network";

export interface ConfidenceInput {
  baseEvidenceStrength: number;
  parserCoverage?: number;
  scopeMatch?: number;
  evidence?: Evidence[];
  corroboratingSources?: number;
  contradictions?: number;
  missingEvidence?: number;
}

export function calculateConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const parserQuality = clamp(input.parserCoverage ?? 100);
  const scopeMatch = clamp(input.scopeMatch ?? 100);
  const freshness = freshnessScore(input.evidence ?? []);
  const corroborationBonus = Math.min(15, Math.max(0, (input.corroboratingSources ?? 0) - 1) * 4);
  const contradictionPenalty = Math.min(35, Math.max(0, input.contradictions ?? 0) * 12);
  const missingEvidencePenalty = Math.min(30, Math.max(0, input.missingEvidence ?? 0) * 5);
  const weighted = input.baseEvidenceStrength * (parserQuality / 100) * (scopeMatch / 100) * (freshness / 100);

  return {
    finalScore: clamp(Math.round(weighted + corroborationBonus - contradictionPenalty - missingEvidencePenalty)),
    evidenceStrength: clamp(input.baseEvidenceStrength),
    parserQuality,
    scopeMatch,
    freshness,
    corroborationBonus,
    contradictionPenalty,
    missingEvidencePenalty
  };
}

function freshnessScore(evidence: Evidence[]): number {
  const ages = evidence.map(item => item.scope?.sourceAgeSeconds).filter((value): value is number => value !== undefined && value >= 0);
  if (!ages.length) return 100;
  const newestAge = Math.min(...ages);
  if (newestAge <= 3600) return 100;
  if (newestAge <= 86400) return 85;
  if (newestAge <= 604800) return 65;
  return 45;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
