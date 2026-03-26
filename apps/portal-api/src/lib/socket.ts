import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { getSession } from './redis.js';

let io: SocketServer;

export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.PORTAL_FRONTEND_URL || 'http://localhost:5174',
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate socket connections via session token
  io.use(async (socket, next) => {
    const sessionId = socket.handshake.auth.sessionId as string;
    if (!sessionId) {
      return next(new Error('Missing session token'));
    }

    const session = await getSession(sessionId);
    if (!session) {
      return next(new Error('Invalid or expired session'));
    }

    // Attach session data to socket
    socket.data.portalUser = session;
    next();
  });

  io.on('connection', (socket) => {
    const { companyId } = socket.data.portalUser;

    // Join company-specific room for real-time messages
    socket.join(`company:${companyId}`);

    socket.on('disconnect', () => {
      // cleanup if needed
    });
  });

  return io;
}

export function getIO(): SocketServer {
  return io;
}

export function emitToCompany(companyId: string, event: string, data: unknown) {
  if (io) {
    io.to(`company:${companyId}`).emit(event, data);
  }
}
