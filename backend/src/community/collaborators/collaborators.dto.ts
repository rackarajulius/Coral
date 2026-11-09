import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { MAX_COLLABORATORS } from './collaborator-rules';

/** A person by user id, or a company by its page's id — as the @ menu names them. */
export class CollaboratorRefDto {
  @IsIn(['person', 'company'])
  kind!: 'person' | 'company';

  @IsUUID()
  id!: string;
}

/** Everyone who should be on the post now; anyone left out is taken off. */
export class SetCollaboratorsDto {
  @IsArray()
  @ArrayMaxSize(MAX_COLLABORATORS)
  @ValidateNested({ each: true })
  @Type(() => CollaboratorRefDto)
  collaborators!: CollaboratorRefDto[];
}

/** Answering for a company page the viewer runs; absent, answering as themselves. */
export class CollaborationAnswerDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class CollaborationSettingsDto {
  @IsBoolean()
  allowCollaborations!: boolean;
}

export class SuggestCollaboratorsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
