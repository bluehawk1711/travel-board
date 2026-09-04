import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderItemsDto {
  @IsUUID()
  sectionId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedItemIds!: string[];
}
