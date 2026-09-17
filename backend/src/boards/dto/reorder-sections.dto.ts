import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderSectionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedSectionIds!: string[];
}
