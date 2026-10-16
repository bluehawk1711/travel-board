import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MESSAGES } from '../common/messages';
import type { AuthUser } from '../auth/auth.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';

@ApiTags('chat')
@ApiBearerAuth('bearer')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /** All conversations the user is a member of, with last message + unread count. */
  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser) {
    return this.chatService.listConversations(user.id);
  }

  /** Create a DIRECT or GROUP conversation. */
  @Post('conversations')
  createConversation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ) {
    if (dto.type === 'DIRECT') {
      if (!dto.userId) {
        throw new BadRequestException(MESSAGES.CHAT.DIRECT_USER_REQUIRED);
      }
      return this.chatService.getOrCreateDirect(user.id, dto.userId);
    }
    return this.chatService.createGroup(user.id, dto);
  }

  @Get('conversations/:conversationId')
  getConversation(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chatService.getConversationDetail(user.id, conversationId);
  }

  /** Paginated message history (newest-first page, cursor = oldest id seen). */
  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chatService.listMessages(
      user.id,
      conversationId,
      query.cursor,
      query.limit ?? 50,
    );
  }

  /** REST fallback for sending — sockets preferred, but this never loses a message. */
  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(
      user.id,
      conversationId,
      dto.body,
    );
    this.chatGateway.broadcastMessage(message);
    return message;
  }

  @Post('conversations/:conversationId/read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.chatService.markRead(
      user.id,
      conversationId,
      dto.lastMessageId,
    );
  }

  /** Get or create the per-board collaboration room (board members only). */
  @Get('boards/:boardId')
  boardConversation(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ) {
    return this.chatService.getOrCreateBoardConversation(user.id, boardId);
  }

  /** Presence lookup: GET /chat/presence?userIds=a,b,c */
  @Get('presence')
  presence(@Query('userIds') userIds?: string) {
    const ids = (userIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.chatService.getPresence(ids);
  }
}
