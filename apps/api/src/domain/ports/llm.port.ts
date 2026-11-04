import {
  GrammarFix,
  RewriteMode,
  RiskEvidence,
  ToneAnalysis,
  GenerateDraftRequest,
  SummarizeRequest,
  SummarizeResponse,
  AiActionRequest,
  AiActionResponse,
} from '@safe-quill/shared';

export const LLM_PORT = Symbol('LlmPort');

export interface LlmRewriteResult {
  rewritten: string;
  explanation: string;
  provider: string; // 'groq' | 'circuit-breaker-fallback'
}

export interface LlmGrammarResult {
  fixes: GrammarFix[];
  correctedText: string;
}

export interface LlmPort {
  rewrite(
    text: string,
    mode: RewriteMode,
    evidence?: RiskEvidence[],
  ): Promise<LlmRewriteResult>;

  analyzeTone(text: string): Promise<ToneAnalysis>;

  generateSubjects(text: string): Promise<string[]>;

  explainGrammar(text: string): Promise<LlmGrammarResult>;

  summarize(text: string): Promise<string>;

  translate(text: string, targetLanguage: string): Promise<string>;

  completeInline(text: string): Promise<string>;

  generateDraft?(
    dto: GenerateDraftRequest,
  ): Promise<{ drafts: Array<{ subject: string; body: string }> }>;

  summarizeRich?(dto: SummarizeRequest): Promise<SummarizeResponse>;

  executeAction?(dto: AiActionRequest): Promise<AiActionResponse>;
}
