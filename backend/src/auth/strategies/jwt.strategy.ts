import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AuthService, AuthUser } from '../auth.service';

interface JwtPayload {
  sub: string;
}

/** Cookie map (cookie-parser does not augment express types here). */
type CookieMap = Record<string, string | undefined>;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        // Authorization header takes precedence (REST + Socket.IO handshake).
        const header = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (header) return header;
        // Fallback: httpOnly cookie set by register/login/refresh/OAuth.
        const cookies = req.cookies as CookieMap | undefined;
        return cookies?.tb_access_token ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    try {
      return await this.authService.getUserById(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
