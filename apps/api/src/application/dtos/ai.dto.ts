import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  GenerateSubjectsRequest,
  GrammarCheckRequest,
  RewriteEmailRequest,
  RewriteMode,
  ToneAnalysisRequest,
} from '@safe-quill/shared';

const REWRITE_MODES: RewriteMode[] = [
  'safe',
  'professional',
  'friendly',
  'formal',
  'shorter',
  'longer',
];

export class RewriteEmailDto implements RewriteEmailRequest {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  body!: string;

  @IsIn(REWRITE_MODES)
  mode!: RewriteMode;
}

export class ToneAnalysisDto implements ToneAnalysisRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  text!: string;
}

export class GenerateSubjectsDto implements GenerateSubjectsRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  body!: string;
}

export class GrammarCheckDto implements GrammarCheckRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  text!: string;
}
