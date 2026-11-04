import { RiskAnalysisResult } from '@safe-quill/shared';

export class HighRiskDetectedEvent {
  constructor(
    public readonly score: number,
    public readonly evidenceReasons: string[],
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class PredictionReportedEvent {
  constructor(
    public readonly result: RiskAnalysisResult,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}
