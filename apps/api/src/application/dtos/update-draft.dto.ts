import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UpdateDraftRequest } from '@safe-quill/shared';

export class UpdateDraftDto implements UpdateDraftRequest {
  @IsString()
  @MaxLength(500, { message: 'Subject must not exceed 500 characters' })
  subject!: string;

  @IsString()
  @MaxLength(100000, { message: 'Body must not exceed 100,000 characters' })
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000, { message: 'Raw headers must not exceed 50,000 characters' })
  rawHeaders?: string;
}
