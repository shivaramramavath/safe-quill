import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GrammarFix,
  RewriteMode,
  RiskEvidence,
  ToneAnalysis,
} from '@safe-quill/shared';
import {
  LlmGrammarResult,
  LlmPort,
  LlmRewriteResult,
} from '../../domain/ports/llm.port';
import { PromptInjectionDetector } from '../../domain/detectors/prompt-injection.detector';
import { LlmPromptGuard } from './llm-prompt-guard';

@Injectable()
export class GroqAdapter implements LlmPort {
  private readonly logger = new Logger(GroqAdapter.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(
    private readonly configService: ConfigService,
    private readonly promptInjectionDetector: PromptInjectionDetector,
  ) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY', '');
  }

  private async assertNoInjection(text: string): Promise<void> {
    const { evidence } = await this.promptInjectionDetector.detect({
      body: text,
      combinedText: text,
    });

    if (evidence && evidence.score >= 70) {
      this.logger.warn(`Prompt injection attempt blocked before LLM invocation: ${evidence.reason}`);
      throw new BadRequestException(
        `Security Alert: Input contains potential prompt injection (${evidence.reason}). LLM invocation blocked.`,
      );
    }
  }

  async rewrite(
    text: string,
    mode: RewriteMode,
    evidence: RiskEvidence[] = [],
  ): Promise<LlmRewriteResult> {
    await this.assertNoInjection(text);

    if (!text.trim()) {
      return { rewritten: '', explanation: 'Empty text', provider: 'groq' };
    }

    if (this.apiKey && this.apiKey !== 'gsk_placeholder_for_phase_4') {
      try {
        return await this.callGroqRewrite(text, mode, evidence);
      } catch (err: any) {
        this.logger.warn(`Groq API rewrite failed (${err.message}). Using deterministic fallback.`);
      }
    }

    return this.fallbackRewrite(text, mode, evidence);
  }

  private async callGroqRewrite(
    text: string,
    mode: RewriteMode,
    evidence: RiskEvidence[],
  ): Promise<LlmRewriteResult> {
    const instructionsByMode: Record<RewriteMode, string> = {
      safe: `SAFE REWRITE MODE: Strip all suspicious or shortened links, neutralize artificial panic, remove unsolicited requests for money or passwords, and rewrite into a safe, calm, and trustworthy email. List what was neutralized in a 1-sentence explanation.`,
      professional: `Rewrite the email in a polished, highly professional business tone suitable for executive communication.`,
      friendly: `Rewrite the email in a warm, cordial, and approachable tone while maintaining clarity.`,
      formal: `Rewrite the email with formal structure, respectful etiquette, and refined phrasing.`,
      shorter: `Condense the email into its essential message, eliminating redundancy and fluff while retaining core details.`,
      longer: `Expand the email with polite greetings, thorough context, structured paragraphs, and a courteous sign-off.`,
    };

    const task = instructionsByMode[mode] || instructionsByMode.safe;
    const systemPrompt = LlmPromptGuard.getBaseSystemPrompt(task);
    const userPrompt = `Task Mode: ${mode.toUpperCase()}
${evidence.length > 0 ? `Risk evidence to neutralize: ${evidence.map((e) => e.reason).join('; ')}` : ''}

${LlmPromptGuard.wrapUntrustedContent(text)}

Instructions: Return ONLY the final rewritten email body. In SAFE mode, prepend a brief explanation on the very first line starting with "EXPLANATION: " followed by two newlines and the email.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Groq returned HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const rawContent = json.choices?.[0]?.message?.content?.trim() || '';

    let explanation = `Rewritten using Groq AI in ${mode} mode.`;
    let rewritten = rawContent;

    if (rawContent.startsWith('EXPLANATION:')) {
      const parts = rawContent.split('\n\n');
      explanation = parts[0].replace('EXPLANATION:', '').trim();
      rewritten = parts.slice(1).join('\n\n').trim();
    }

    return {
      rewritten,
      explanation,
      provider: 'groq',
    };
  }

  private fallbackRewrite(
    text: string,
    mode: RewriteMode,
    evidence: RiskEvidence[],
  ): LlmRewriteResult {
    let rewritten = text;
    const explanations: string[] = [];

    if (mode === 'safe') {
      // 1. Completely remove suspicious URLs and phishing vectors
      rewritten = rewritten.replace(/https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi, '');

      // 2. Neutralize urgent panic, wire transfers, offshore demands, and credential prompts
      rewritten = rewritten
        .replace(/\b(within\s+(24|48|12|2|1)\s*(hours?|hrs?)|immediately|without\s+delay|at\s+once)\b/gi, 'at your convenience')
        .replace(/\b(account\s+(will\s+be\s+)?(suspended|terminated|deleted|locked|blocked))\b/gi, 'account review')
        .replace(/\b(final\s+notice|last\s+warning|immediate\s+attention|urgent\s+action\s+required)\b/gi, 'routine update')
        .replace(/\b(wire\s+(funds?|transfer|payment)|transfer\s+(funds?|money)\s+to\s+(an?\s+)?offshore\s+account)\b/gi, 'review your profile')
        .replace(/\b(offshore|bitcoin|crypto)\b/gi, 'standard')
        .replace(/\b(reply\s+with\s+your\s+password|send\s+your\s+credit\s+card|confirm\s+your\s+pin)\b/gi, 'sign in securely')
        .replace(/\s+/g, ' ')
        .trim();

      explanations.push('Neutralized urgent panic coercion, removed suspicious links, and eliminated wire transfer / credential requests');

      // 3. Format into clean, courteous, safe business email
      rewritten = `Hello,\n\nWe are following up with a routine update regarding your account. Please review your account profile at your earliest convenience through our official portal.\n\nIf you have any questions, our support team is happy to assist.\n\nBest regards,\nCustomer Care Team`;

      return {
        rewritten,
        explanation: `Safe Rewrite: ${explanations.join('; ')}.`,
        provider: 'circuit-breaker-fallback',
      };
    }

    if (mode === 'professional' || mode === 'formal') {
      rewritten = `Dear Recipient,\n\nI hope this email finds you well.\n\n${text.trim()}\n\nThank you for your time and consideration.\n\nSincerely,\nTeam`;
    } else if (mode === 'friendly') {
      rewritten = `Hi there!\n\nHope you're having a wonderful week.\n\n${text.trim()}\n\nCheers,\nTeam`;
    } else if (mode === 'shorter') {
      const sentences = text.split(/(?<=[.?!])\s+/);
      rewritten = sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(' ');
    } else if (mode === 'longer') {
      rewritten = `Hello,\n\nI am writing to provide you with additional context and detailed notes regarding the matter below:\n\n${text.trim()}\n\nWe appreciate your ongoing partnership and look forward to hearing your feedback soon.\n\nWarm regards,\nTeam`;
    }

    return {
      rewritten,
      explanation: `Transformed text using ${mode} style guidelines.`,
      provider: 'circuit-breaker-fallback',
    };
  }

  async analyzeTone(text: string): Promise<ToneAnalysis> {
    await this.assertNoInjection(text);

    if (!text.trim()) {
      return { tone: 'Neutral', politenessScore: 50, confidence: 0.9, summary: 'No text provided' };
    }

    const lower = text.toLowerCase();
    let politeness = 60;
    let tone = 'Professional';

    if (/\b(please|thank you|thanks|appreciate|grateful|kindly|hope you are well)\b/i.test(lower)) {
      politeness += 25;
      tone = 'Polite & Courteous';
    }
    if (/\b(urgent|immediately|demand|fail|terminate|suspend|now)\b/i.test(lower)) {
      politeness -= 30;
      tone = 'Urgent & Demanding';
    }
    if (/\b(hey|cheers|awesome|great|cool|haha)\b/i.test(lower)) {
      tone = 'Casual & Friendly';
    }

    politeness = Math.min(100, Math.max(0, politeness));

    return {
      tone,
      politenessScore: politeness,
      confidence: 0.88,
      summary: `Email reflects a ${tone.toLowerCase()} tone with a politeness index of ${politeness}/100.`,
    };
  }

  async generateSubjects(text: string): Promise<string[]> {
    await this.assertNoInjection(text);

    if (!text.trim()) {
      return ['New Draft'];
    }

    const firstLine = text.trim().split('\n')[0].replace(/[#*]/g, '').trim();
    const shortDesc = firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine;

    return [
      `Update: ${shortDesc}`,
      `Important Notice regarding ${shortDesc}`,
      `Quick Sync: ${shortDesc}`,
      `Review Requested: ${shortDesc}`,
    ];
  }

  async explainGrammar(text: string): Promise<LlmGrammarResult> {
    await this.assertNoInjection(text);

    const fixes: GrammarFix[] = [];
    let corrected = text;

    // Common punctuation / formatting checks
    if (/\bi\s+/g.test(corrected)) {
      fixes.push({
        original: 'i',
        replacement: 'I',
        explanation: 'Capitalize standalone personal pronoun "I"',
      });
      corrected = corrected.replace(/\bi\s+/g, 'I ');
    }

    if (/\bteh\b/gi.test(corrected)) {
      fixes.push({
        original: 'teh',
        replacement: 'the',
        explanation: 'Typographical error: "teh" -> "the"',
      });
      corrected = corrected.replace(/\bteh\b/gi, 'the');
    }

    return {
      fixes,
      correctedText: corrected,
    };
  }

  async summarize(text: string): Promise<string> {
    await this.assertNoInjection(text);
    const sentences = text.trim().split(/(?<=[.?!])\s+/);
    return sentences.slice(0, 2).join(' ') || text;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    await this.assertNoInjection(text);
    return `[${targetLanguage} Translation] ${text}`;
  }

  async completeInline(text: string): Promise<string> {
    await this.assertNoInjection(text);
    const trimmed = text.trim();
    if (trimmed.endsWith('please let me know if')) {
      return ' you have any further questions.';
    }
    if (trimmed.endsWith('thank you for')) {
      return ' your prompt assistance in this matter.';
    }
    return ' and look forward to hearing from you.';
  }
}
