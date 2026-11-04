import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MagicLinkDto {
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  baseUrl?: string;
}

export class VerifyMagicLinkDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class GoogleAuthDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  googleId!: string;
}

export class SaveSessionDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  rawHeaders?: string;

  @IsOptional()
  analysisSnapshot?: {
    score: number;
    verdict: string;
    cuesCount?: number;
    timestamp: string;
  };
}

export class RenameSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;
}

export class SendReportDto {
  @IsEmail()
  @IsNotEmpty()
  recipientEmail!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsNumber()
  score!: number;

  @IsString()
  @IsNotEmpty()
  verdict!: string;

  @IsArray()
  @IsString({ each: true })
  cues!: string[];
}
