export interface SendEmailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
  inReplyTo?: string;
  threadId?: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface GmailHistoryResult {
  historyId: string;
  messagesAdded: Array<{
    messageId: string;
    threadId: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
  }>;
}
