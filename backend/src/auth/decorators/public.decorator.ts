import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/**
 * Marks a route as publicly accessible. When set, the global JwtAuthGuard
 * skips authentication but still attaches req.user if a valid token is sent
 * (optional auth), so handlers can personalize responses for logged-in users.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
