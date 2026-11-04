export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskEvidence {
  detectorName: string;
  level: RiskLevel;
  score: number; // 0 to 100
  reason: string;
  flaggedTokens?: string[];
  underlines?: {
    start: number;
    end: number;
    type: 'solid' | 'dashed' | 'wavy';
    reason: string;
  }[];
}

export interface RiskAnalysisResult {
  score: number; // 0 to 100
  level: RiskLevel;
  isSpam: boolean;
  confidence: number;
  evidence: RiskEvidence[];
  latencyMs: number;
  cached: boolean;
}
