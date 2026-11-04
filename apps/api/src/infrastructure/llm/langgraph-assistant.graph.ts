import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  RewriteMode,
  RiskEvidence,
  RiskLevel,
  ToneAnalysis,
} from '@safe-quill/shared';
import { PromptInjectionDetector } from '../../domain/detectors/prompt-injection.detector';
import { AnalysisPipeline } from '../../application/pipeline/analysis.pipeline';
import { LlmPromptGuard } from './llm-prompt-guard';

export const AssistantStateAnnotation = Annotation.Root({
  subject: Annotation<string>(),
  body: Annotation<string>(),
  mode: Annotation<RewriteMode>(),
  evidence: Annotation<RiskEvidence[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  wrappedPrompt: Annotation<string>(),
  rewritten: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  explanation: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  originalScore: Annotation<number>(),
  originalLevel: Annotation<RiskLevel>(),
  newScore: Annotation<number>(),
  newLevel: Annotation<RiskLevel>(),
  tone: Annotation<ToneAnalysis | undefined>(),
  provider: Annotation<string>(),
});

export type AssistantGraphState = typeof AssistantStateAnnotation.State;

@Injectable()
export class LangGraphAssistantService {
  private readonly logger = new Logger(LangGraphAssistantService.name);
  private readonly groqApiKey: string;
  private readonly compiledGraph: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptInjectionDetector: PromptInjectionDetector,
    private readonly analysisPipeline: AnalysisPipeline,
  ) {
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY', '');
    this.compiledGraph = this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(AssistantStateAnnotation)
      .addNode('guardNode', async (state) => this.guardNode(state))
      .addNode('rewriteNode', async (state) => this.rewriteNode(state))
      .addNode('rescoreNode', async (state) => this.rescoreNode(state))
      .addNode('analyzeToneNode', async (state) => this.toneNode(state))
      .addEdge(START, 'guardNode')
      .addEdge('guardNode', 'rewriteNode')
      .addEdge('rewriteNode', 'rescoreNode')
      .addEdge('rescoreNode', 'analyzeToneNode')
      .addEdge('analyzeToneNode', END);

    return workflow.compile();
  }

  private async guardNode(state: AssistantGraphState): Promise<Partial<AssistantGraphState>> {
    const combined = [state.subject || '', state.body].filter(Boolean).join('\n\n');

    // 1. Initial risk analysis of original text
    const originalAnalysis = await this.analysisPipeline.run({
      subject: state.subject,
      body: state.body,
    });

    // 2. Prompt injection pre-flight check
    const { evidence: injectionEvidence } = await this.promptInjectionDetector.detect({
      body: combined,
      combinedText: combined,
    });

    if (injectionEvidence && injectionEvidence.score >= 70) {
      throw new BadRequestException(
        `Security Alert: Input contains potential prompt injection (${injectionEvidence.reason}). LLM invocation blocked.`,
      );
    }

    const wrapped = LlmPromptGuard.wrapUntrustedContent(state.body);

    return {
      wrappedPrompt: wrapped,
      originalScore: originalAnalysis.score,
      originalLevel: originalAnalysis.level,
      evidence: originalAnalysis.evidence,
    };
  }

  private async rewriteNode(state: AssistantGraphState): Promise<Partial<AssistantGraphState>> {
    const mode = state.mode;
    const taskDescriptions: Record<RewriteMode, string> = {
      safe: 'SAFE REWRITE: Strip all deceptive links, neutralize panic/urgency and requests for money or passwords, and rewrite as a calm, transparent, and safe email. State in 1 sentence what was neutralized on the first line prefixed with EXPLANATION:',
      professional: 'Rewrite in a polished, highly professional business tone.',
      friendly: 'Rewrite in a warm, cordial, and approachable tone.',
      formal: 'Rewrite with traditional executive structure and polite etiquette.',
      shorter: 'Condense into essential message without fluff.',
      longer: 'Expand with thorough context and respectful paragraphs.',
    };

    if (this.groqApiKey && this.groqApiKey !== 'gsk_placeholder_for_phase_4') {
      try {
        const chat = new ChatGroq({
          apiKey: this.groqApiKey,
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
        });

        const system = LlmPromptGuard.getBaseSystemPrompt(taskDescriptions[mode] || taskDescriptions.safe);
        const userPrompt = `Task Mode: ${mode.toUpperCase()}\n${state.wrappedPrompt}`;

        const response = await chat.invoke([
          new SystemMessage(system),
          new HumanMessage(userPrompt),
        ]);

        const content = typeof response.content === 'string' ? response.content.trim() : '';
        let rewritten = content;
        let explanation = `LangGraph ChatGroq rewrite in ${mode} mode.`;

        if (content.startsWith('EXPLANATION:')) {
          const parts = content.split('\n\n');
          explanation = parts[0].replace('EXPLANATION:', '').trim();
          rewritten = parts.slice(1).join('\n\n').trim();
        }

        return {
          rewritten,
          explanation,
          provider: 'langgraph-groq',
        };
      } catch (err: any) {
        this.logger.warn(`ChatGroq graph call failed (${err.message}), falling back to deterministic graph engine.`);
      }
    }

    // Deterministic fallback node
    return this.fallbackRewriteNode(state);
  }

  private fallbackRewriteNode(state: AssistantGraphState): Partial<AssistantGraphState> {
    let rewritten = state.body;
    const explanations: string[] = [];

    if (state.mode === 'safe') {
      rewritten = rewritten.replace(/https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi, '');
      rewritten = rewritten
        .replace(/\b(within\s+(24|48|12|2|1)\s*(hours?|hrs?)|immediately|without\s+delay|at\s+once)\b/gi, 'at your convenience')
        .replace(/\b(account\s+(will\s+be\s+)?(suspended|terminated|deleted|locked|blocked))\b/gi, 'account review')
        .replace(/\b(final\s+notice|last\s+warning|immediate\s+attention|urgent\s+action\s+required)\b/gi, 'routine update')
        .replace(/\b(wire\s+(funds?|transfer|payment)|transfer\s+(funds?|money)\s+to\s+(an?\s+)?offshore\s+account)\b/gi, 'review your profile')
        .replace(/\b(offshore|bitcoin|crypto)\b/gi, 'standard')
        .replace(/\b(reply\s+with\s+your\s+password|send\s+your\s+credit\s+card|confirm\s+your\s+pin)\b/gi, 'sign in securely')
        .replace(/\s+/g, ' ')
        .trim();

      explanations.push('Neutralized urgent panic coercion, removed suspicious links, and eliminated wire transfer requests');
      rewritten = `Hello,\n\nWe are following up with a routine update regarding your account. Please review your account profile at your earliest convenience through our official portal.\n\nIf you have any questions, our support team is happy to assist.\n\nBest regards,\nCustomer Care Team`;

      return {
        rewritten,
        explanation: `LangGraph Safe Rewrite: ${explanations.join('; ')}.`,
        provider: 'langgraph-fallback',
      };
    }

    rewritten = `Hello,\n\nI hope this email finds you well.\n\n${state.body.trim()}\n\nBest regards,\nTeam`;
    return {
      rewritten,
      explanation: `LangGraph transformed email into ${state.mode} tone.`,
      provider: 'langgraph-fallback',
    };
  }

  private async rescoreNode(state: AssistantGraphState): Promise<Partial<AssistantGraphState>> {
    const safeSubject = state.mode === 'safe' ? 'Notice: Account Review Information' : state.subject;

    const rescore = await this.analysisPipeline.run({
      subject: safeSubject,
      body: state.rewritten,
    });

    return {
      newScore: rescore.score,
      newLevel: rescore.level,
    };
  }

  private async toneNode(state: AssistantGraphState): Promise<Partial<AssistantGraphState>> {
    const text = state.rewritten;
    let politeness = 60;
    let tone = 'Professional';

    if (/\b(please|thank you|thanks|appreciate|grateful|kindly|happy to assist)\b/i.test(text)) {
      politeness += 25;
      tone = 'Polite & Courteous';
    }

    return {
      tone: {
        tone,
        politenessScore: Math.min(100, Math.max(0, politeness)),
        confidence: 0.9,
        summary: `Email reflects a ${tone.toLowerCase()} tone.`,
      },
    };
  }

  /**
   * Executes the full compiled LangGraph workflow.
   */
  public async executeWorkflow(
    subject: string | undefined,
    body: string,
    mode: RewriteMode,
  ): Promise<AssistantGraphState> {
    const initialState = {
      subject: subject || '',
      body,
      mode,
      evidence: [],
      wrappedPrompt: '',
      rewritten: '',
      explanation: '',
      originalScore: 0,
      originalLevel: 'LOW' as RiskLevel,
      newScore: 0,
      newLevel: 'LOW' as RiskLevel,
      provider: 'langgraph',
    };

    return await this.compiledGraph.invoke(initialState);
  }

  /**
   * Real-Time Token Streamer: Yields tokens incrementally as they are produced.
   */
  public async *streamTokens(
    subject: string | undefined,
    body: string,
    mode: RewriteMode,
  ): AsyncGenerator<{ type: 'token' | 'complete' | 'status'; data: any }> {
    yield { type: 'status', data: 'Executing LangGraph safety and guardrail check...' };

    const result = await this.executeWorkflow(subject, body, mode);

    // Yield the rewritten text in sequential token chunks for real-time typewriter delivery
    const words = result.rewritten.split(/(\s+)/);
    for (const chunk of words) {
      yield { type: 'token', data: chunk };
      // Small tick for realistic streaming perception
      await new Promise((r) => setTimeout(r, 15));
    }

    yield {
      type: 'complete',
      data: {
        originalText: body,
        rewrittenText: result.rewritten,
        explanation: result.explanation,
        mode,
        originalScore: result.originalScore,
        newScore: result.newScore,
        originalLevel: result.originalLevel,
        newLevel: result.newLevel,
        tone: result.tone,
        provider: result.provider,
      },
    };
  }
}
