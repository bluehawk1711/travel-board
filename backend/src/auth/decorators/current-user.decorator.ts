import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth.service';

/** Reads the authenticated user attached by JwtAuthGuard from the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    return request.user;
  },
);
