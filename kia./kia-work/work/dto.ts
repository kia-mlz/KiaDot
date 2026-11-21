import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  category!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;
}

export class ApplyJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cover?: string;
}

export class ApplicationStatusDto {
  @IsIn(['applied', 'reviewing', 'interview', 'rejected', 'hired'])
  status!: string;
}

export class UpsertProfileDto {
  @IsOptional() @IsString() @MaxLength(140) headline?: string;
  @IsOptional() @IsString() @MaxLength(4000) bio?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) rateIrr?: number;
  @IsOptional() @IsString() @MaxLength(2000) services?: string;
  @IsOptional() @IsString() @MaxLength(4000) experience?: string;
  @IsOptional() @IsString() @MaxLength(4000) portfolio?: string;
  @IsOptional() @IsString() @MaxLength(500) resumeUrl?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

export class CreateProjectDto {
  @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @IsString() @MinLength(10) @MaxLength(4000) brief!: string;
  @Type(() => Number) @IsInt() @Min(0) budgetIrr!: number;
  @IsOptional() @IsString() deadline?: string;
}

export class ProposalDto {
  @IsString() @MinLength(10) @MaxLength(4000) pitch!: string;
  @Type(() => Number) @IsInt() @Min(0) amountIrr!: number;
}

export class HireDto {
  @IsString() proposalId!: string;
}

export class MilestoneDto {
  @IsString() @MinLength(2) @MaxLength(140) title!: string;
  @Type(() => Number) @IsInt() @Min(0) amountIrr!: number;
}

export class ReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MinLength(2) @MaxLength(1000) body!: string;
}
