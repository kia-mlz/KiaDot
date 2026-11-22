import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const STYLES = ['kinetic', 'code', 'split', 'motion'] as const;
const ASPECTS = ['1920x1080', '1280x720'] as const;
const QUALITIES = ['standard', 'high'] as const;
const POSITIONS = ['BEFORE_BODY', 'AFTER_OBJECTIVES'] as const;

export class CreateMotionProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lessonId!: string;

  @IsOptional()
  @IsIn(STYLES)
  style?: (typeof STYLES)[number];

  @IsOptional()
  @IsIn(ASPECTS)
  aspect?: (typeof ASPECTS)[number];

  @IsOptional()
  @IsInt()
  @IsIn([24, 30])
  fps?: 24 | 30;

  @IsOptional()
  @IsIn(QUALITIES)
  quality?: (typeof QUALITIES)[number];

  @IsOptional()
  @IsIn(['fa', 'en'])
  language?: 'fa' | 'en';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  voiceId?: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(600)
  targetDurationSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  sceneCountHint?: number;

  @IsOptional()
  @IsBoolean()
  autoRender?: boolean;
}

export class UpdateMotionProjectDto {
  @IsOptional()
  @IsIn(STYLES)
  style?: (typeof STYLES)[number];

  @IsOptional()
  @IsIn(ASPECTS)
  aspect?: (typeof ASPECTS)[number];

  @IsOptional()
  @IsInt()
  @IsIn([24, 30])
  fps?: 24 | 30;

  @IsOptional()
  @IsIn(QUALITIES)
  quality?: (typeof QUALITIES)[number];

  @IsOptional()
  @IsIn(['fa', 'en'])
  language?: 'fa' | 'en';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  voiceId?: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(600)
  targetDurationSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  sceneCountHint?: number;

  @IsOptional()
  @IsBoolean()
  autoRender?: boolean;

  @IsOptional()
  @IsIn(POSITIONS)
  position?: (typeof POSITIONS)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  minWatchPercent?: number | null;
}

export class UpdateMotionSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  maxTokens?: number;
}

export class ReorderScenesDto {
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  orderedIds!: string[];
}

export class SceneWriteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  narration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  narrationEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  onScreenText?: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(40)
  durationSec?: number;

  @IsOptional()
  @IsIn(STYLES)
  animationType?: (typeof STYLES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  codeLanguage?: string;
}

export class PublishMotionDto {
  @IsString()
  @MinLength(1)
  lessonId!: string;

  @IsOptional()
  @IsIn(POSITIONS)
  position?: (typeof POSITIONS)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  minWatchPercent?: number | null;
}

export class SubtitleWriteDto {
  @IsIn(['fa', 'en'])
  locale!: 'fa' | 'en';

  @IsIn(['vtt', 'srt'])
  format!: 'vtt' | 'srt';

  @IsString()
  @MaxLength(100_000)
  body!: string;
}

export class ProgressWriteDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(86_400)
  lastTimeSec!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0.1)
  @Max(86_400)
  durationSec?: number;

  @IsOptional()
  @IsBoolean()
  ended?: boolean;

  @IsOptional()
  @IsBoolean()
  viewStart?: boolean;
}
