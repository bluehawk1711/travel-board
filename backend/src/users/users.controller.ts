import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthUser } from '../auth/auth.service';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Find someone to start a DM with (chat UI). */
  @Get('search')
  search(@Query('q') q = '') {
    return this.usersService.search(q);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  /** Per-user preferences (theme, notifications, currency). */
  @Get('me/settings')
  getSettings(@CurrentUser() user: AuthUser) {
    return this.usersService.getSettings(user.id);
  }

  @Patch('me/settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.id, dto);
  }

  /** Public profile; `isFollowing` reflects the signed-in viewer when present. */
  @Public()
  @Get(':id')
  profile(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.usersService.profile(id, user?.id);
  }

  /** Public boards owned by a user (profile grid). */
  @Public()
  @Get(':id/boards')
  boards(
    @Param('id') id: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    return this.usersService.userBoards(id, parsedLimit, parsedOffset);
  }
}
