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
  maskPii,
  predictLocalNextWord,
  chunkTextForSummary,
  GenerateDraftRequest,
  SummarizeRequest,
  SummarizeResponse,
  AiActionRequest,
  AiActionResponse,
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
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptInjectionDetector: PromptInjectionDetector,
  ) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY', '');
    this.model = this.configService.get<string>('GROQ_MODEL', 'openai/gpt-oss-120b');
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'User-Agent': 'SafeQuill-App/1.0',
    };
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
      headers: this.getHeaders(),
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
    const rich = await this.summarizeRich({ text, mode: 'short' });
    return rich.summary;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    await this.assertNoInjection(text);
    const action = await this.executeAction({
      action: 'translate',
      text,
      targetLanguage,
    });
    return action.resultText;
  }

  async completeInline(text: string): Promise<string> {
    await this.assertNoInjection(text);

    // Limit context to last ~600 chars
    const context = text.slice(-600);
    const { maskedText, restore } = maskPii(context);

    if (this.apiKey && !this.apiKey.includes('placeholder')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content:
                  'You are an inline email auto-completion assistant. Given the preceding email context, predict and complete the current sentence naturally up to 25 tokens. Return ONLY the continuation text with leading space if appropriate. NEVER suggest URLs, hyperlinks, or markdown links. Do not repeat the context.',
              },
              {
                role: 'user',
                content: LlmPromptGuard.wrapUntrustedContent(maskedText),
              },
            ],
            max_tokens: 25,
            temperature: 0.3,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          let completion = data.choices?.[0]?.message?.content?.trim() || '';
          // Strip any accidental URLs
          completion = completion.replace(/https?:\/\/\S+/gi, '').replace(/www\.\S+/gi, '');
          if (completion) {
            return restore(completion.startsWith(' ') ? completion : ` ${completion}`);
          }
        }
      } catch (err: any) {
        this.logger.debug(`Groq inline completion fell back to local n-gram: ${err.message}`);
      }
    }

    // Silent fallback to Tier (a) local n-gram
    return predictLocalNextWord(text) || '';
  }

  async generateDraft(
    dto: GenerateDraftRequest,
  ): Promise<{ drafts: Array<{ subject: string; body: string }> }> {
    await this.assertNoInjection(dto.prompt);

    const lengthGuide =
      dto.length === 'short'
        ? 'under 100 words'
        : dto.length === 'long'
        ? 'around 250-350 words'
        : 'around 150-200 words';

    const systemPrompt = `You are a professional email composer. Draft an email according to the user instructions.
Recipient context: ${dto.recipient || 'general professional'}
Tone: ${dto.tone || 'professional'}
Desired length: ${lengthGuide}
${dto.currentSubject ? `Current subject to refine: ${dto.currentSubject}` : ''}
${dto.variants ? 'Generate exactly 3 distinctly styled draft variations.' : 'Generate 1 polished draft.'}
Return ONLY valid JSON matching this schema:
${dto.variants ? '{"drafts": [{"subject": "...", "body": "..."}, {"subject": "...", "body": "..."}, {"subject": "...", "body": "..."}]}' : '{"drafts": [{"subject": "...", "body": "..."}]}'}`;

    if (this.apiKey && !this.apiKey.includes('placeholder')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: LlmPromptGuard.wrapUntrustedContent(dto.prompt) },
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          if (Array.isArray(parsed.drafts) && parsed.drafts.length > 0) {
            return { drafts: parsed.drafts };
          }
        }
      } catch (err: any) {
        this.logger.warn(`Groq generateDraft fallback used: ${err.message}`);
      }
    }

    // High quality deterministic fallback
    const fallbackSubject = dto.currentSubject || `Regarding: ${dto.prompt.slice(0, 40)}`;
    const fallbackBody = `Dear ${dto.recipient || 'Team'},\n\nI am writing regarding ${dto.prompt}.\n\nPlease review and let me know if you have any questions or require additional details.\n\nBest regards,\nSafeQuill Team`;

    return {
      drafts: dto.variants
        ? [
            { subject: fallbackSubject, body: fallbackBody },
            {
              subject: `Quick Update: ${fallbackSubject}`,
              body: `Hi ${dto.recipient || 'there'},\n\nWanted to reach out briefly about ${dto.prompt}.\n\nLooking forward to catching up soon.\n\nThanks,\nSafeQuill Team`,
            },
            {
              subject: `Formal Notice: ${fallbackSubject}`,
              body: `Dear ${dto.recipient || 'Colleague'},\n\nThis communication pertains to ${dto.prompt}. Your attention to this matter is appreciated.\n\nSincerely,\nSafeQuill Team`,
            },
          ]
        : [{ subject: fallbackSubject, body: fallbackBody }],
    };
  }

  async summarizeRich(dto: SummarizeRequest): Promise<SummarizeResponse> {
    await this.assertNoInjection(dto.text);

    let workingText = dto.text;
    let safetyNote: string | undefined;

    if (dto.safeSummary) {
      // Neutralize raw links, phone numbers, and payment cards
      workingText = workingText
        .replace(/https?:\/\/\S+/gi, '[link neutralized]')
        .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[phone redacted]')
        .replace(/\b(?:\d{4}[-\s]?){3}\d{1,4}\b/g, '[payment details redacted]');
      safetyNote =
        'Safe summary mode: All raw URLs, contact numbers, and payment details have been neutralized to prevent accidental exploitation.';
    }

    // Chunking for long emails
    const chunks = chunkTextForSummary(workingText, 2500);
    const wordCount = workingText.trim().split(/\s+/).length;
    const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

    // Detected Intent & Tone heuristic
    const isUrgent = /(urgent|immediate|asap|deadline|suspend)/i.test(workingText);
    const isFinancial = /(invoice|payment|wire|bank|transfer|fee|bill)/i.test(workingText);
    const intent = isFinancial
      ? 'Financial / Transactional Inquiry'
      : isUrgent
      ? 'Urgent Action Required'
      : 'General Business Communication';
    const detectedTone = isUrgent ? 'Coercive / Urgent' : 'Informative';
    const detectedLang = /(hola|gracias|urgente)/i.test(workingText)
      ? 'Spanish'
      : /(hallo|danke|dringend)/i.test(workingText)
      ? 'German'
      : 'English';

    if (this.apiKey && !this.apiKey.includes('placeholder')) {
      try {
        const modeInstruction =
          dto.mode === 'tldr'
            ? 'Provide a 1-sentence executive TL;DR summary.'
            : dto.mode === 'short'
            ? 'Provide a concise 3-bullet-point summary.'
            : dto.mode === 'action_items'
            ? 'Extract all explicit action items in JSON: {"actionItems": [{"owner": "...", "task": "...", "deadline": "..."}]}'
            : dto.mode === 'key_facts'
            ? 'Extract all key facts in JSON: {"keyFacts": {"dates": [...], "amounts": [...], "names": [...], "links": [...]}}'
            : 'Provide a detailed, well-structured paragraph summary.';

        const isJsonMode = dto.mode === 'action_items' || dto.mode === 'key_facts';
        const requestPayload: any = {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an email analysis and summarization specialist. ${modeInstruction} Return plain text for tldr/short/detailed, or valid JSON for action_items/key_facts. Do NOT repeat or echo the email. Provide only the concise analysis/summary.`,
            },
            {
              role: 'user',
              content: `Please analyze and summarize the following email content:\n\n${LlmPromptGuard.wrapUntrustedContent(chunks[0])}`,
            },
          ],
          temperature: 0.2,
        };
        if (isJsonMode) {
          requestPayload.response_format = { type: 'json_object' };
        }

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(requestPayload),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim() || '';

          let parsedActionItems;
          let parsedKeyFacts;
          let displaySummary = content;

          const extractJson = (raw: string): any => {
            const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            try {
              return JSON.parse(cleaned);
            } catch {
              const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
              if (match) {
                try {
                  return JSON.parse(match[0]);
                } catch {}
              }
            }
            return null;
          };

          if (dto.mode === 'action_items') {
            const parsed = extractJson(content);
            if (parsed) {
              parsedActionItems = parsed.actionItems || (Array.isArray(parsed) ? parsed : undefined);
              if (Array.isArray(parsedActionItems) && parsedActionItems.length > 0) {
                displaySummary = parsedActionItems
                  .map((it: any) => `• [${it.owner || 'Action'}] ${it.task}${it.deadline ? ` (Due: ${it.deadline})` : ''}`)
                  .join('\n');
              }
            }
          } else if (dto.mode === 'key_facts') {
            const parsed = extractJson(content);
            if (parsed) {
              parsedKeyFacts = parsed.keyFacts || parsed;
              const bullets: string[] = [];
              if (parsedKeyFacts.names?.length) bullets.push(`• People & Entities: ${parsedKeyFacts.names.join(', ')}`);
              if (parsedKeyFacts.dates?.length) bullets.push(`• Dates & Deadlines: ${parsedKeyFacts.dates.join(', ')}`);
              if (parsedKeyFacts.amounts?.length) bullets.push(`• Amounts & Figures: ${parsedKeyFacts.amounts.join(', ')}`);
              if (parsedKeyFacts.links?.length) bullets.push(`• Links & Domains: ${parsedKeyFacts.links.join(', ')}`);
              if (bullets.length > 0) {
                displaySummary = bullets.join('\n');
              } else {
                displaySummary = 'No prominent dates, amounts, or entities detected in the text.';
              }
            }
          }

          return {
            summary: displaySummary,
            mode: dto.mode,
            intent,
            tone: detectedTone,
            language: detectedLang,
            readingTimeMin,
            safetyNote,
            actionItems: parsedActionItems,
            keyFacts: parsedKeyFacts,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Groq summarizeRich fallback used: ${err.message}`);
      }
    }

    // High quality deterministic fallback summary
    const sentences = workingText.split(/(?<=[.?!])\s+/);
    const substantive = sentences.filter(
      (s) => s.trim().length > 10 && !/^(dear|hello|hi|hey|greetings|subject:)/i.test(s.trim()),
    );
    const firstSubstantive = substantive[0] || sentences[0] || 'Email overview unavailable.';

    const dates = workingText.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi) || [];
    const amounts = workingText.match(/[\$€£]\s?\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+\s?(?:USD|EUR|GBP|INR|dollars|cents)\b/gi) || [];
    const links = dto.safeSummary ? [] : (workingText.match(/https?:\/\/\S+/g) || []);
    const nameMatches = Array.from(new Set(workingText.match(/\b[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+\b/g) || []))
      .filter((n) => !['Dear Recipient', 'Best Regards', 'Safe Quill', 'Sincerely Yours', 'Recipient Name', 'Expression Of Interest'].includes(n));

    let fallbackSummary = `Summary: ${firstSubstantive}`;
    if (dto.mode === 'tldr') {
      fallbackSummary = `TL;DR: ${firstSubstantive}`;
    } else if (dto.mode === 'short') {
      const bullets = (substantive.length >= 2 ? substantive.slice(0, 3) : sentences.slice(0, 3))
        .map((s) => `• ${s.trim()}`);
      fallbackSummary = bullets.join('\n');
    } else if (dto.mode === 'key_facts') {
      const bullets: string[] = [];
      if (nameMatches.length) bullets.push(`• Key Entities: ${nameMatches.join(', ')}`);
      if (dates.length) bullets.push(`• Dates: ${dates.join(', ')}`);
      if (amounts.length) bullets.push(`• Amounts: ${amounts.join(', ')}`);
      if (links.length) bullets.push(`• Links: ${links.join(', ')}`);
      fallbackSummary = bullets.length > 0 ? bullets.join('\n') : `• Core Focus: ${firstSubstantive}`;
    } else if (dto.mode === 'action_items') {
      fallbackSummary = `• Review email context and take appropriate action if requested.\n• Follow up on pending questions or deliverables.`;
    } else {
      fallbackSummary = `The email pertains to "${firstSubstantive.slice(0, 100)}...". Please review details for full context.`;
    }

    return {
      summary: fallbackSummary,
      mode: dto.mode,
      intent,
      tone: detectedTone,
      language: detectedLang,
      readingTimeMin,
      safetyNote,
      actionItems: [
        {
          owner: 'Recipient',
          task: 'Review email context and respond if required',
          deadline: isUrgent ? 'Today' : 'Standard',
        },
      ],
      keyFacts: {
        dates,
        amounts,
        names: nameMatches,
        links,
      },
    };
  }

  async executeAction(dto: AiActionRequest): Promise<AiActionResponse> {
    await this.assertNoInjection(dto.text);

    let instruction = '';
    if (dto.action === 'fix_grammar') {
      instruction = 'Fix all grammatical errors, typos, and formatting issues. Keep phrasing authentic.';
    } else if (dto.action === 'expand') {
      instruction = 'Expand this email draft with polite context, pleasantries, and structured paragraphs.';
    } else if (dto.action === 'shorten') {
      instruction = 'Shorten this email aggressively to its core purpose. Eliminate all unnecessary fluff.';
    } else if (dto.action === 'translate') {
      instruction = `Translate this email into ${dto.targetLanguage || 'Spanish'} while preserving professional etiquette.`;
    } else if (dto.action === 'generate_reply') {
      instruction = `Generate a polite, clear email reply with intent "${dto.replyIntent || 'polite acknowledgment'}".`;
    } else if (dto.action === 'extract_action_items') {
      instruction = 'Extract key bullet points of tasks, next steps, and deliverables from this email.';
    }

    if (this.apiKey && !this.apiKey.includes('placeholder')) {
      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: `You are an AI email assistant. Task: ${instruction}. Return ONLY the final revised email text.`,
              },
              { role: 'user', content: LlmPromptGuard.wrapUntrustedContent(dto.text) },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let resultText = data.choices?.[0]?.message?.content?.trim() || dto.text;
          if (resultText.startsWith('```') && resultText.endsWith('```')) {
            resultText = resultText.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
          }
          return {
            resultText,
            explanation:
              dto.action === 'translate'
                ? `Translated to ${dto.targetLanguage || 'Spanish'} via Groq AI.`
                : `Action "${dto.action}" completed via Groq AI.`,
          };
        }
      } catch (err: any) {
        this.logger.warn(`executeAction Groq fallback: ${err.message}`);
      }
    }

    return {
      resultText:
        dto.action === 'shorten'
          ? dto.text.split(/(?<=[.?!])\s+/).slice(0, 2).join(' ')
          : dto.action === 'translate'
          ? `[${dto.targetLanguage || 'Spanish'} Translation]: ${dto.text}`
          : dto.action === 'generate_reply'
          ? `Thank you for reaching out.\n\nI have received your email regarding this matter and will review it promptly.\n\nBest regards,\nSafeQuill Team`
          : dto.text,
      explanation: `Action "${dto.action}" completed via local fallback.`,
    };
  }
}
