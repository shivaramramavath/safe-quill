import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiActionRequest,
  AiActionResponse,
  GenerateDraftRequest,
  GenerateDraftResponse,
  GeneratedDraft,
  InlineCompleteResponse,
  RewriteEmailResponse,
  SummarizeRequest,
  SummarizeResponse,
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

  async completeInline(text: string): Promise<InlineCompleteResponse> {
    const completion = await this.llm.completeInline(text);
    return {
      completion,
      tier: completion ? 'groq' : 'local',
      aiUsed: !!completion,
    };
  }

  async generate(dto: GenerateDraftRequest): Promise<GenerateDraftResponse> {
    const generated = this.llm.generateDraft
      ? await this.llm.generateDraft(dto)
      : {
          drafts: [
            {
              subject: dto.currentSubject || `Notice: ${dto.prompt.slice(0, 30)}`,
              body: `Hello,\n\nI am contacting you regarding ${dto.prompt}.\n\nPlease let me know if you have any questions.\n\nBest regards,\nSafeQuill User`,
            },
          ],
        };

    const analyzedDrafts: GeneratedDraft[] = [];

    for (const d of generated.drafts) {
      const analysis = await this.analysisPipeline.run({
        subject: d.subject,
        body: d.body,
      });

      analyzedDrafts.push({
        subject: d.subject,
        body: d.body,
        score: analysis.score,
        level: analysis.level,
        isSpam: analysis.isSpam,
        topTokens: analysis.topTokens,
      });
    }

    return { drafts: analyzedDrafts };
  }

  async summarizeRich(dto: SummarizeRequest): Promise<SummarizeResponse> {
    if (this.llm.summarizeRich) {
      return this.llm.summarizeRich(dto);
    }

    const simple = await this.llm.summarize(dto.text);
    return {
      summary: simple,
      mode: dto.mode,
      intent: 'General Communication',
      tone: 'Neutral',
      language: 'English',
      readingTimeMin: 1,
      safetyNote: dto.safeSummary ? 'Safe summary mode enabled.' : undefined,
    };
  }

  async executeAction(dto: AiActionRequest): Promise<AiActionResponse> {
    if (this.llm.executeAction) {
      return this.llm.executeAction(dto);
    }

    return {
      resultText: dto.text,
      explanation: `Action completed.`,
    };
  }
}
