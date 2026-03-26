import { google } from 'googleapis';
import type { SendEmailOptions, SendEmailResult, EmailProvider, GmailTokens, GmailHistoryResult } from './types.js';

export class GmailProvider implements EmailProvider {
  private oauth2Client;

  constructor(
    private tokens: GmailTokens,
    clientId: string,
    clientSecret: string,
  ) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * Refreshes the access token if expired. Returns updated tokens or null if no refresh needed.
   */
  async refreshIfNeeded(): Promise<GmailTokens | null> {
    if (this.tokens.expiry_date > Date.now() + 60_000) {
      return null; // still valid for at least 1 minute
    }

    const { credentials } = await this.oauth2Client.refreshAccessToken();
    const updated: GmailTokens = {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || this.tokens.refresh_token,
      expiry_date: credentials.expiry_date!,
    };
    this.oauth2Client.setCredentials(updated);
    return updated;
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const messageParts = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
    ];

    if (options.inReplyTo) {
      messageParts.push(`In-Reply-To: ${options.inReplyTo}`);
      messageParts.push(`References: ${options.inReplyTo}`);
    }

    messageParts.push('', options.html);

    const raw = Buffer.from(messageParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: options.threadId,
      },
    });

    return {
      messageId: res.data.id!,
      threadId: res.data.threadId!,
    };
  }

  /**
   * Fetches Gmail history since the given historyId.
   * Returns new messages received (for reply detection).
   */
  async getHistory(startHistoryId: string): Promise<GmailHistoryResult> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    });

    const messagesAdded: GmailHistoryResult['messagesAdded'] = [];

    if (res.data.history) {
      for (const entry of res.data.history) {
        if (!entry.messagesAdded) continue;
        for (const msg of entry.messagesAdded) {
          if (!msg.message?.id) continue;

          // Fetch message metadata
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.message.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });

          const headers = detail.data.payload?.headers || [];
          const getHeader = (name: string) => headers.find(h => h.name === name)?.value || '';

          messagesAdded.push({
            messageId: msg.message.id,
            threadId: msg.message.threadId || '',
            from: getHeader('From'),
            subject: getHeader('Subject'),
            snippet: detail.data.snippet || '',
            date: getHeader('Date'),
          });
        }
      }
    }

    return {
      historyId: res.data.historyId || startHistoryId,
      messagesAdded,
    };
  }

  /**
   * Gets the current historyId for initial sync setup.
   */
  async getProfile(): Promise<{ historyId: string; emailAddress: string }> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const res = await gmail.users.getProfile({ userId: 'me' });
    return {
      historyId: res.data.historyId?.toString() || '',
      emailAddress: res.data.emailAddress || '',
    };
  }

  /**
   * Gets the daily send count for rate limiting.
   * Uses Gmail API to search for sent messages today.
   */
  async getDailySendCount(): Promise<number> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const today = new Date();
    const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `in:sent after:${dateStr}`,
      maxResults: 1,
    });

    return res.data.resultSizeEstimate || 0;
  }
}
