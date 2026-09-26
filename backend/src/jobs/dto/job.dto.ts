import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export const JOB_STATUSES = ['draft', 'active', 'paused', 'closed', 'archived'] as const;
export const JOB_SORT_OPTIONS = ['newest', 'oldest', 'salary_asc', 'salary_desc'] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];
export type JobSortValue = (typeof JOB_SORT_OPTIONS)[number];

export class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  experienceLevel?: string;

  @IsOptional()
  @IsBoolean()
  remoteOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minSalary?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSalary?: number;

  @IsOptional()
  @IsEnum(JOB_STATUSES)
  status?: JobStatusValue;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsUUID()
  postedById?: string;

  @IsOptional()
  @IsEnum(JOB_SORT_OPTIONS)
  sort?: JobSortValue = 'newest';

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class CreateJobDto {
  // Admin-only: attribute the job to a specific employer instead of the poster.
  @IsOptional()
  @IsUUID()
  employerId?: string;

  // Admin-only: manually provide employer details when no linked employer account is selected.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  companyLogo?: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  // Alias for frontend forms that submit jobType.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  experienceLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  @IsOptional()
  @IsBoolean()
  isHybrid?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  salaryCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  salaryPeriod?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  responsibilities?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  applicationDeadline?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxApplicants?: number;

  @IsOptional()
  @IsIn(['internal', 'external', 'email'])
  applicationMethod?: string;

  /** Required when applicationMethod is 'external'. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  applicationUrl?: string;

  /** Required when applicationMethod is 'email'. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  applicationEmail?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @IsOptional()
  @IsEnum(JOB_STATUSES)
  status?: JobStatusValue;
}

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  experienceLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  @IsOptional()
  @IsBoolean()
  isHybrid?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  salaryCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  salaryPeriod?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  responsibilities?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  applicationDeadline?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxApplicants?: number;

  @IsOptional()
  @IsIn(['internal', 'external', 'email'])
  applicationMethod?: string;

  /** Required when applicationMethod is 'external'. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  applicationUrl?: string;

  /** Required when applicationMethod is 'email'. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  applicationEmail?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @IsOptional()
  @IsEnum(JOB_STATUSES)
  status?: JobStatusValue;
}
