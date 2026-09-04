import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthUser } from '../auth/auth.service';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/member.dto';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoardDto) {
    return this.boardsService.create(user, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthUser) {
    return this.boardsService.findMine(user);
  }

  /** Public boards for everyone; private boards require membership. */
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.boardsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardsService.update(id, user, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.boardsService.remove(id, user);
  }

  // ── Likes & saves ─────────────────────────────────────────
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':id/like')
  toggleLike(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.boardsService.toggleLike(id, user);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':id/save')
  toggleSave(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.boardsService.toggleSave(id, user);
  }

  // ── Sections ──────────────────────────────────────────────
  @Post(':id/sections')
  createSection(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSectionDto,
  ) {
    return this.boardsService.createSection(id, user, dto);
  }

  @Patch('sections/:sectionId')
  updateSection(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.boardsService.updateSection(sectionId, user, dto);
  }

  @Delete('sections/:sectionId')
  removeSection(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.boardsService.removeSection(sectionId, user);
  }

  // ── Items ─────────────────────────────────────────────────
  @Post(':id/items')
  createItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateItemDto,
  ) {
    return this.boardsService.createItem(id, user, dto);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateItemDto,
  ) {
    return this.boardsService.updateItem(itemId, user, dto);
  }

  @Delete('items/:itemId')
  removeItem(@Param('itemId') itemId: string, @CurrentUser() user: AuthUser) {
    return this.boardsService.removeItem(itemId, user);
  }

  @Patch(':id/items/reorder')
  reorderItems(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.boardsService.reorderItems(id, user, dto);
  }

  // ── Members ───────────────────────────────────────────────
  @Get(':id/members')
  listMembers(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.boardsService.listMembers(id, user);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.boardsService.addMember(id, user, dto);
  }

  @Patch(':id/members/:userId')
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.boardsService.updateMemberRole(id, userId, user, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.boardsService.removeMember(id, userId, user);
  }
}
