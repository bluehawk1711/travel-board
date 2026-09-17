import { IsInt, IsPositive } from 'class-validator';

export class MarkReadDto {
  /** messages.id the reader has seen (inclusive). */
  @IsInt()
  @IsPositive()
  lastMessageId!: number;
}
