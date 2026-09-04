import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';

/** Invites are always EDITOR/VIEWER — only the board creator can be OWNER. */
export class AddMemberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsEnum(['EDITOR', 'VIEWER'])
  role?: 'EDITOR' | 'VIEWER';
}

export class UpdateMemberRoleDto {
  @IsEnum(['OWNER', 'EDITOR', 'VIEWER'])
  role!: 'OWNER' | 'EDITOR' | 'VIEWER';
}
