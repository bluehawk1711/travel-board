import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

/**
 * Data attached to each socket by the JWT handshake middleware.
 * `boards` tracks the board rooms the socket joined, so disconnect can
 * clean up per-board presence.
 */
export interface SocketData {
  userId: string;
  boards?: Set<string>;
}

/**
 * Socket.IO handshake middleware: verifies the JWT sent as
 * `socket.handshake.auth.token` (same secret as the REST API) and attaches
 * the user id to `socket.data`. Used by every realtime gateway so auth is
 * enforced consistently regardless of which gateway a client connects to.
 */
export function createJwtSocketAuth(jwtService: JwtService) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }
    jwtService
      .verifyAsync<{ sub: string }>(token)
      .then((payload) => {
        (socket.data as SocketData).userId = payload.sub;
        next();
      })
      .catch(() => next(new Error('Unauthorized')));
  };
}
