import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { MESSAGES } from '../common/messages';
import { AuthService } from './auth.service';
import type { AuthUser, TokensResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() dto: RegisterDto): Promise<TokensResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto): Promise<TokensResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto): Promise<TokensResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<{ success: true }> {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): { user: AuthUser } {
    return { user };
  }

  // ── Google OAuth ──────────────────────────────────────────
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = (req as Request & { user?: AuthUser }).user;
    if (!user) {
      throw new UnauthorizedException(MESSAGES.AUTH.USER_NOT_FOUND);
    }
    const tokens = await this.authService.issueTokens(user.id);
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const url = new URL('/auth/callback', frontendUrl);
    url.searchParams.set('access_token', tokens.accessToken);
    url.searchParams.set('refresh_token', tokens.refreshToken);
    res.redirect(url.toString());
  }
}
