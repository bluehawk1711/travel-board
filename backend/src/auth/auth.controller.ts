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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleMobileDto } from './dto/google-mobile.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@ApiBearerAuth('bearer')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensResponse> {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result);
    return result;
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensResponse> {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result);
    return result;
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensResponse> {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const token = dto.refreshToken ?? cookies?.tb_refresh_token;
    if (!token) {
      throw new UnauthorizedException(MESSAGES.AUTH.INVALID_REFRESH_TOKEN);
    }
    const result = await this.authService.refresh(token);
    this.setAuthCookies(res, result);
    return result;
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const token = dto.refreshToken ?? cookies?.tb_refresh_token;
    if (token) {
      await this.authService.logout(token);
    }
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ success: boolean }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokensResponse> {
    const result = await this.authService.resetPassword(
      dto.token,
      dto.password,
    );
    this.setAuthCookies(res, result);
    return result;
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

  /** Mobile token exchange: verify a Google id_token, issue the JWT pair. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/mobile')
  async googleMobile(@Body() dto: GoogleMobileDto): Promise<TokensResponse> {
    return this.authService.googleMobileSignIn(dto.idToken);
  }

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

    // Set httpOnly cookies instead of URL query params (H3).
    this.setAuthCookies(res, tokens);

    // Redirect with access token in body via a short-lived fragment (JS reads it).
    const url = new URL('/auth/callback', frontendUrl);
    url.searchParams.set('access_token', tokens.accessToken);
    res.redirect(url.toString());
  }

  // ── Cookie helpers ─────────────────────────────────────────

  private setAuthCookies(res: Response, tokens: TokensResponse): void {
    const isProd = this.configService.get('NODE_ENV') === 'production';
    res.cookie('tb_access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });
    res.cookie('tb_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie('tb_access_token', { path: '/' });
    res.clearCookie('tb_refresh_token', { path: '/auth' });
  }
}
