import 'dotenv/config';
import { setupEmailQueues } from './setup-email-queues.js';

console.log('[worker] Starting BuildKit CRM worker...');

// Initialize email queues and processors
setupEmailQueues();

console.log('[worker] Worker started successfully');
