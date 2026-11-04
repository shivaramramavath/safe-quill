export interface PredictionFeedback {
  id: string;
  reportedLabel: 'spam' | 'ham';
  reason?: string;
  contentHash?: string;
  originalScore: number;
  originalLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reviewed: boolean;
  createdAt: string;
}

export interface CreatePredictionFeedbackRequest {
  reportedLabel: 'spam' | 'ham';
  reason?: string;
  contentHash?: string;
  originalScore: number;
  originalLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AiFeedback {
  id: string;
  mode: string;
  rating: 'thumbs_up' | 'thumbs_down';
  comment?: string;
  createdAt: string;
}

export interface CreateAiFeedbackRequest {
  mode: string;
  rating: 'thumbs_up' | 'thumbs_down';
  comment?: string;
}

export interface SystemConfig {
  highThreshold: number; // default 75
  mediumThreshold: number; // default 40
  blockedDomains: string[];
  blockedKeywords: string[];
  updatedAt: string;
}

export interface UpdateSystemConfigRequest {
  highThreshold?: number;
  mediumThreshold?: number;
  blockedDomains?: string[];
  blockedKeywords?: string[];
}

export interface ConfusionMatrix {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

export interface MlMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: ConfusionMatrix;
  fpr: number;
  fnr: number;
  activeModelVersion: string;
  availableVersions: string[];
}

export interface AnalyticsOverview {
  totalScans: number;
  spamCount: number;
  hamCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  avgLatencyMs: number;
  pendingFeedbackCount: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  performedBy?: string;
  timestamp: string;
}
