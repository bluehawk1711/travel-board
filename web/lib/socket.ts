import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';
import { getAccessToken } from './auth';

/**
 * Singleton Socket.IO client. Authenticated via the JWT access token in the
 * handshake (`auth.token`) — anonymous users get a rejected socket, so callers
 * must catch and fall back to a static view.
 *
 * NOTE: created once per page load; sign in/out requires a reload to refresh
 * the handshake token.
 */
let socket: Socket | null = null;

export async function getBoardSocket(): Promise<Socket> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not signed in — live updates unavailable');
  }
  if (socket?.connected) {
    return socket;
  }
  if (socket) {
    socket.connect();
    return socket;
  }
  socket = io(API_URL, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
  return socket;
}
