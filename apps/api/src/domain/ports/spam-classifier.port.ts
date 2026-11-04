import { RiskLevel, TokenWeight } from '@safe-quill/shared';

export const SPAM_CLASSIFIER_PORT = Symbol('SpamClassifierPort');

export interface SpamClassifierResult {
  label: 'spam' | 'ham';
  confidence: number;
  score: number;
  level: RiskLevel;
  topTokens: TokenWeight[];
  modelVersion: string;
}

export interface SpamClassifierPort {
  classify(text: string): Promise<SpamClassifierResult>;
}
