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

export interface InlineCompleteRequest {
  text: string;
}

export interface InlineCompleteResponse {
  completion: string;
  tier: 'groq' | 'local';
  aiUsed: boolean;
}

export interface GenerateDraftRequest {
  prompt: string;
  recipient?: string;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
  variants?: boolean;
  currentSubject?: string;
}

export interface GeneratedDraft {
  subject: string;
  body: string;
  score: number;
  level: RiskLevel;
  isSpam: boolean;
  topTokens?: Array<{ token: string; weight: number }>;
}

export interface GenerateDraftResponse {
  drafts: GeneratedDraft[];
}

export type SummaryMode = 'tldr' | 'short' | 'detailed' | 'action_items' | 'key_facts';

export interface SummarizeRequest {
  text: string;
  mode: SummaryMode;
  safeSummary?: boolean;
}

export interface ActionItem {
  owner?: string;
  task: string;
  deadline?: string;
}

export interface SummarizeResponse {
  summary: string;
  mode: SummaryMode;
  intent: string;
  tone: string;
  language: string;
  readingTimeMin: number;
  safetyNote?: string;
  actionItems?: ActionItem[];
  keyFacts?: {
    dates: string[];
    amounts: string[];
    names: string[];
    links: string[];
  };
}

export type AiActionType =
  | 'fix_grammar'
  | 'expand'
  | 'shorten'
  | 'translate'
  | 'generate_reply'
  | 'extract_action_items';

export interface AiActionRequest {
  text: string;
  action: AiActionType;
  targetLanguage?: string;
  replyIntent?: string;
}

export interface AiActionResponse {
  resultText: string;
  explanation: string;
  score?: number;
  level?: RiskLevel;
}
