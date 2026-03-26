import 'dotenv/config';
import http from 'http';
import { createApp } from './app.js';
import { initSocket } from './lib/socket.js';

const app = createApp();
const server = http.createServer(app);

initSocket(server);

const PORT = process.env.PORTAL_API_PORT || 3002;

server.listen(PORT, () => {
  console.log(`BuildKit Portal API running on port ${PORT}`);
});
