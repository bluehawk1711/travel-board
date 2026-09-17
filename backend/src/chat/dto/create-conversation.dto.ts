import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateConversationDto {
  @IsIn(['DIRECT', 'GROUP'])
  type!: 'DIRECT' | 'GROUP';

  /** Required when type = DIRECT: the other participant. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Required when type = GROUP: other members (excluding the creator). */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(49)
  @IsUUID('4', { each: true })
  memberIds?: string[];

  /** Group display name (GROUP only). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
