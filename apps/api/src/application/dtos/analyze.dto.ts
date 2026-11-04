import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AnalyzeEmailRequest } from '@safe-quill/shared';

export class AnalyzeDto implements AnalyzeEmailRequest {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsString()
  @MaxLength(100000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  rawHeaders?: string;
}

export class AnalyzeEmlDto {
  @IsString()
  @MaxLength(500000)
  emlContent!: string;
}
