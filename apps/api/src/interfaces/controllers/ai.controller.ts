import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
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
