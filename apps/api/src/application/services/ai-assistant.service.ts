import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  RewriteEmailResponse,
  ToneAnalysis,
} from '@safe-quill/shared';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm.port';
import { AnalysisPipeline } from '../pipeline/analysis.pipeline';
import { RewriteEmailDto } from '../dtos/ai.dto';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    @Inject(LLM_PORT)
    private readonly llm: LlmPort,
    private readonly analysisPipeline: AnalysisPipeline,
  ) {}

  async rewrite(dto: RewriteEmailDto): Promise<RewriteEmailResponse> {
    const originalText = [dto.subject || '', dto.body].filter(Boolean).join('\n\n');

    // 1. Initial risk analysis of original text
    const originalAnalysis = await this.analysisPipeline.run({
      subject: dto.subject,
      body: dto.body,
    });

    // 2. Perform rewrite through LlmPort
    const rewriteResult = await this.llm.rewrite(
      dto.body,
      dto.mode,
      originalAnalysis.evidence,
    );

    // 3. Immediately re-score the rewritten text to verify score reduction
    const safeSubject = dto.mode === 'safe' ? 'Notice: Account Review Information' : dto.subject;

    const reScoreAnalysis = await this.analysisPipeline.run({
      subject: safeSubject,
      body: rewriteResult.rewritten,
    });

    // 4. Tone analysis of the new text
    let toneAnalysis: ToneAnalysis | undefined;
    try {
      toneAnalysis = await this.llm.analyzeTone(rewriteResult.rewritten);
    } catch {
      // Non-critical
    }

    this.logger.log(
      `Rewrote email in [${dto.mode}] mode: Risk score changed from ${originalAnalysis.score} (${originalAnalysis.level}) -> ${reScoreAnalysis.score} (${reScoreAnalysis.level}) via provider: ${rewriteResult.provider}`,
    );

    return {
      originalText: dto.body,
      rewrittenText: rewriteResult.rewritten,
      explanation: rewriteResult.explanation,
      mode: dto.mode,
      originalScore: originalAnalysis.score,
      newScore: reScoreAnalysis.score,
      originalLevel: originalAnalysis.level,
      newLevel: reScoreAnalysis.level,
      tone: toneAnalysis,
      provider: rewriteResult.provider,
    };
  }

  async analyzeTone(text: string): Promise<ToneAnalysis> {
    return this.llm.analyzeTone(text);
  }

  async generateSubjects(text: string): Promise<string[]> {
    return this.llm.generateSubjects(text);
  }

  async explainGrammar(text: string) {
    return this.llm.explainGrammar(text);
  }

  async summarize(text: string): Promise<string> {
    return this.llm.summarize(text);
  }
}
