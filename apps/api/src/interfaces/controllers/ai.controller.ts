import {
  Body,
  Controller,
  Post,
  Res,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import {
  GenerateSubjectsResponse,
  GrammarCheckResponse,
  RewriteEmailResponse,
  ToneAnalysis,
} from '@safe-quill/shared';
import { AiAssistantService } from '../../application/services/ai-assistant.service';
import {
  GenerateSubjectsDto,
  GrammarCheckDto,
  RewriteEmailDto,
  ToneAnalysisDto,
} from '../../application/dtos/ai.dto';
import { GuestSessionInterceptor } from '../interceptors/guest-session.interceptor';

@Controller('api/v1/ai')
@UseInterceptors(GuestSessionInterceptor)
export class AiController {
  constructor(private readonly aiService: AiAssistantService) {}

  @Post('rewrite')
  async rewrite(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: RewriteEmailDto,
  ): Promise<RewriteEmailResponse> {
    return this.aiService.rewrite(dto);
  }

  @Post('stream-rewrite')
  async streamRewrite(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: RewriteEmailDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const chunk of this.aiService.streamRewrite(dto)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.end();
    } catch (err: any) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: err.message || 'Streaming failed' })}\n\n`,
      );
      res.end();
    }
  }

  @Post('tone')
  async analyzeTone(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: ToneAnalysisDto,
  ): Promise<ToneAnalysis> {
    return this.aiService.analyzeTone(dto.text);
  }

  @Post('subjects')
  async generateSubjects(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: GenerateSubjectsDto,
  ): Promise<GenerateSubjectsResponse> {
    const subjects = await this.aiService.generateSubjects(dto.body);
    return { subjects };
  }

  @Post('grammar')
  async explainGrammar(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: GrammarCheckDto,
  ): Promise<GrammarCheckResponse> {
    return this.aiService.explainGrammar(dto.text);
  }
}
