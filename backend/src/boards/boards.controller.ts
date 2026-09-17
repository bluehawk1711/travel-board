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
import { BoardsGateway } from './boards.gateway';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/member.dto';

@Controller('boards')
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly boardsGateway: BoardsGateway,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoardDto) {
    return this.boardsService.create(user, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthUser) {
    return this.boardsService.findMine(user);
  }

  /** Boards the current user has saved (mobile "Saved" tab). */
  @Get('saved')
  findSaved(@CurrentUser() user: AuthUser) {
    return this.boardsService.findSaved(user);
  }

  /** Public boards for everyone; private boards require membership. */
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.boardsService.findOne(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBoardDto,
  ) {
    const board = await this.boardsService.update(id, user, dto);
    this.broadcast({
      type: 'board:updated',
      boardId: id,
      actorId: user.id,
    });
    return board;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const result = await this.boardsService.remove(id, user);
    this.broadcast({
      type: 'board:removed',
      boardId: id,
      actorId: user.id,
    });
    return result;
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
  async createSection(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSectionDto,
  ) {
    const section = await this.boardsService.createSection(id, user, dto);
    this.broadcast({
      type: 'section:created',
      boardId: id,
      actorId: user.id,
      section,
    });
    return section;
  }

  @Patch('sections/:sectionId')
  async updateSection(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSectionDto,
  ) {
    const section = await this.boardsService.updateSection(
      sectionId,
      user,
      dto,
    );
    this.broadcast({
      type: 'section:updated',
      boardId: section.boardId,
      actorId: user.id,
      section,
      sectionId,
    });
    return section;
  }

  @Delete('sections/:sectionId')
  async removeSection(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const section = await this.boardsService.requireSection(sectionId);
    const result = await this.boardsService.removeSection(sectionId, user);
    this.broadcast({
      type: 'section:removed',
      boardId: section.boardId,
      actorId: user.id,
      sectionId,
    });
    return result;
  }

  // ── Items ─────────────────────────────────────────────────
  @Post(':id/items')
  async createItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateItemDto,
  ) {
    const item = await this.boardsService.createItem(id, user, dto);
    this.broadcast({
      type: 'item:created',
      boardId: id,
      actorId: user.id,
      item,
    });
    return item;
  }

  @Patch('items/:itemId')
  async updateItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateItemDto,
  ) {
    const item = await this.boardsService.updateItem(itemId, user, dto);
    this.broadcast({
      type: 'item:updated',
      boardId: item.boardId,
      actorId: user.id,
      item,
      itemId,
    });
    return item;
  }

  @Delete('items/:itemId')
  async removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const item = await this.boardsService.requireItem(itemId);
    const result = await this.boardsService.removeItem(itemId, user);
    this.broadcast({
      type: 'item:removed',
      boardId: item.boardId,
      actorId: user.id,
      itemId,
    });
    return result;
  }

  @Patch(':id/items/reorder')
  async reorderItems(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderItemsDto,
  ) {
    const result = await this.boardsService.reorderItems(id, user, dto);
    this.broadcast({
      type: 'items:reordered',
      boardId: id,
      actorId: user.id,
      sectionId: dto.sectionId,
      orderedItemIds: dto.orderedItemIds,
    });
    return result;
  }

  @Patch(':id/sections/reorder')
  async reorderSections(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderSectionsDto,
  ) {
    const result = await this.boardsService.reorderSections(id, user, dto);
    this.broadcast({
      type: 'sections:reordered',
      boardId: id,
      actorId: user.id,
      orderedSectionIds: dto.orderedSectionIds,
    });
    return result;
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

  private broadcast(
    event: Omit<Parameters<BoardsGateway['broadcastBoardChange']>[0], 'at'>,
  ): void {
    this.boardsGateway.broadcastBoardChange({
      ...event,
      at: new Date().toISOString(),
    });
  }
}
