import { io, type Socket } from 'socket.io-client';
import { API_URL, getAccessToken } from './api';

let socket: Socket | null = null;

export async function getBoardSocket(): Promise<Socket> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in — live updates unavailable');
  }

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    // Existing socket was disconnected (network drop or token expiry) —
    // re-authenticate with a fresh token and reconnect.
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(API_URL, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 750,
    reconnectionDelayMax: 5_000,
    randomizationFactor: 0.25,
    timeout: 10_000,
    // Note: `pingInterval`/`pingTimeout` are server-side Socket.IO options and
    // are not accepted by the client typings. Dead half-open TCP connections
    // (common on mobile networks) are handled by the handshake `timeout` above
    // plus the built-in reconnection loop.
  });

  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
