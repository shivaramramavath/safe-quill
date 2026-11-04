import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { SpamClassificationDto } from '@safe-quill/shared';
import { AnalysisFacade } from '../../application/facades/analysis.facade';
import { AnalyzeDto } from '../../application/dtos/analyze.dto';
import { GuestSessionInterceptor } from '../interceptors/guest-session.interceptor';

@Controller('api/v1/analyze')
@UseInterceptors(GuestSessionInterceptor)
export class AnalysisController {
  constructor(private readonly analysisFacade: AnalysisFacade) {}

  @Post()
  async analyze(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AnalyzeDto,
  ): Promise<SpamClassificationDto> {
    return this.analysisFacade.analyze(dto);
  }
}
