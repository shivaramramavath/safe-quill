import { RiskEvidence, RiskLevel } from './risk';

export type RewriteMode =
  | 'safe'
  | 'professional'
  | 'friendly'
  | 'formal'
  | 'shorter'
  | 'longer';

export interface GrammarFix {
  original: string;
  replacement: string;
  explanation: string;
}

export interface ToneAnalysis {
  tone: string;
  politenessScore: number; // 0 to 100
  confidence: number;
  summary: string;
}

export interface RewriteEmailRequest {
  subject?: string;
  body: string;
  mode: RewriteMode;
  evidence?: RiskEvidence[];
}

export interface RewriteEmailResponse {
  originalText: string;
  rewrittenText: string;
  explanation: string;
  mode: RewriteMode;
  originalScore: number;
  newScore: number;
  originalLevel: RiskLevel;
  newLevel: RiskLevel;
  tone?: ToneAnalysis;
  provider: string; // 'groq' | 'circuit-breaker-fallback'
}

export interface ToneAnalysisRequest {
  text: string;
}

export interface GenerateSubjectsRequest {
  body: string;
}

export interface GenerateSubjectsResponse {
  subjects: string[];
}

export interface GrammarCheckRequest {
  text: string;
}

export interface GrammarCheckResponse {
  fixes: GrammarFix[];
  correctedText: string;
}
