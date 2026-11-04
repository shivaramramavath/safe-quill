export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TokenWeight {
  token: string;
  weight: number;
}

export interface UnderlineHighlight {
  start: number;
  end: number;
  type: 'solid' | 'dashed' | 'wavy';
  reason: string;
  text?: string;
}

export interface RiskEvidence {
  detectorName: string;
  level: RiskLevel;
  score: number; // 0 to 100
  reason: string;
  flaggedTokens?: string[];
  underlines?: UnderlineHighlight[];
}

export interface SpamClassificationDto {
  label: 'spam' | 'ham';
  confidence: number;
  score: number; // 0 to 100
  level: RiskLevel;
  topTokens: TokenWeight[];
  modelVersion: string;
  cached: boolean;
  latencyMs: number;
}

export interface AnalyzeEmailRequest {
  subject?: string;
  body: string;
  rawHeaders?: string;
}

export interface RiskAnalysisResult {
  score: number; // 0 to 100
  level: RiskLevel;
  isSpam: boolean;
  confidence: number;
  evidence: RiskEvidence[];
  topTokens: TokenWeight[];
  latencyMs: number;
  cached: boolean;
  modelVersion: string;
}
