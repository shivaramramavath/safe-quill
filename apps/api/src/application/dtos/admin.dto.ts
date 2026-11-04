import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePredictionFeedbackDto {
  @IsIn(['spam', 'ham'], { message: "reportedLabel must be 'spam' or 'ham'" })
  @IsNotEmpty()
  reportedLabel!: 'spam' | 'ham';

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  contentHash?: string;

  @IsNumber()
  originalScore!: number;

  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  @IsNotEmpty()
  originalLevel!: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class CreateAiFeedbackDto {
  @IsString()
  @IsNotEmpty()
  mode!: string;

  @IsIn(['thumbs_up', 'thumbs_down'])
  @IsNotEmpty()
  rating!: 'thumbs_up' | 'thumbs_down';

  @IsString()
  @IsOptional()
  comment?: string;
}

export class UpdateSystemConfigDto {
  @IsInt()
  @Min(50)
  @Max(100)
  @IsOptional()
  highThreshold?: number;

  @IsInt()
  @Min(10)
  @Max(69)
  @IsOptional()
  mediumThreshold?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockedDomains?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockedKeywords?: string[];
}

export class RollbackModelDto {
  @IsString()
  @IsNotEmpty()
  version!: string;
}
