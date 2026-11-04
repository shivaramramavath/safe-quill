import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  RewriteEmailResponse,
  ToneAnalysis,
} from '@safe-quill/shared';
import { LLM_PORT, LlmPort } from '../../domain/ports/llm.port';
import { AnalysisPipeline } from '../pipeline/analysis.pipeline';
import { LangGraphAssistantService } from '../../infrastructure/llm/langgraph-assistant.graph';
import { RewriteEmailDto } from '../dtos/ai.dto';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    @Inject(LLM_PORT)
    private readonly llm: LlmPort,
    private readonly analysisPipeline: AnalysisPipeline,
    private readonly langGraphAssistant: LangGraphAssistantService,
  ) {}

  async rewrite(dto: RewriteEmailDto): Promise<RewriteEmailResponse> {
    const graphResult = await this.langGraphAssistant.executeWorkflow(
      dto.subject,
      dto.body,
      dto.mode,
    );

    return {
      originalText: dto.body,
      rewrittenText: graphResult.rewritten,
      explanation: graphResult.explanation,
      mode: dto.mode,
      originalScore: graphResult.originalScore,
      newScore: graphResult.newScore,
      originalLevel: graphResult.originalLevel,
      newLevel: graphResult.newLevel,
      tone: graphResult.tone,
      provider: graphResult.provider,
    };
  }

  async *streamRewrite(dto: RewriteEmailDto) {
    yield* this.langGraphAssistant.streamTokens(dto.subject, dto.body, dto.mode);
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
