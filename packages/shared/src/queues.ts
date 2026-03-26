// Email queues
export const EMAIL_SEND_QUEUE = 'email:send';
export const SEQUENCE_TICK_QUEUE = 'email:sequence-tick';
export const GMAIL_SYNC_QUEUE = 'email:gmail-sync';

export const EMAIL_QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
};
