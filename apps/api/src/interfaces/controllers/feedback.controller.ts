import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { FeedbackService } from '../../application/services/feedback.service';
import {
  CreateAiFeedbackDto,
  CreatePredictionFeedbackDto,
} from '../../application/dtos/admin.dto';

@Controller('api/v1/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('prediction')
  async submitPredictionFeedback(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePredictionFeedbackDto,
  ) {
    const record = await this.feedbackService.createPredictionFeedback(dto);
    return {
      success: true,
      message:
        'Thank you! Your feedback has been queued for human analyst review. Raw email contents are never logged or auto-retrained.',
      feedbackId: record.id,
    };
  }

  @Post('ai')
  async submitAiFeedback(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateAiFeedbackDto,
  ) {
    const record = await this.feedbackService.createAiFeedback(dto);
    return {
      success: true,
      message: 'AI assistant feedback recorded.',
      feedbackId: record.id,
    };
  }
}
