import {
  Body,
  Controller,
  Post,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  GhostMetricsRecord,
  GhostTextService,
} from '../../application/services/ghost-text.service';

export class NextWordDto {
  @IsString()
  @MaxLength(600)
  context: string;

  @IsOptional()
  @IsBoolean()
  allowLlmTier?: boolean;
}

@Controller(['suggest', 'api/v1/suggest'])
export class SuggestController {
  constructor(private readonly ghostService: GhostTextService) {}

  @Post('next-word')
  async suggestNextWord(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: NextWordDto,
    @Req() req: Request,
  ) {
    const sessionId = (req.cookies?.['safequill_session'] as string) || req.ip;
    return this.ghostService.suggestNextWord(dto, sessionId);
  }

  @Post('metrics')
  async recordMetrics(@Body() metric: GhostMetricsRecord) {
    this.ghostService.recordMetric(metric);
    return { ok: true };
  }
}
