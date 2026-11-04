import { Body, Controller, Post } from '@nestjs/common';
import { ExportService } from '../../application/services/export.service';

@Controller('api/v1/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('txt')
  exportTxt(
    @Body()
    payload: {
      subject: string;
      body: string;
      score?: number;
      level?: string;
    },
  ) {
    return this.exportService.exportTxt(
      payload.subject,
      payload.body,
      payload.score,
      payload.level,
    );
  }

  @Post('eml')
  exportEml(
    @Body()
    payload: {
      subject: string;
      body: string;
      from?: string;
      to?: string;
      rawHeaders?: string;
    },
  ) {
    return this.exportService.exportEml(
      payload.subject,
      payload.body,
      payload.from,
      payload.to,
      payload.rawHeaders,
    );
  }

  @Post('json')
  exportJson(@Body() payload: any) {
    return this.exportService.exportJson(payload);
  }
}
