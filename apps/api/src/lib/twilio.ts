import twilio from 'twilio';
import { requireEnv } from './env.js';

const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
const authToken = requireEnv('TWILIO_AUTH_TOKEN');

export const twilioClient = twilio(accountSid, authToken);

export const TWILIO_PHONE_NUMBER = requireEnv('TWILIO_PHONE_NUMBER');

export async function sendSms(to: string, body: string): Promise<{ sid: string; status: string }> {
  const apiBaseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'https://buildkitapi-production.up.railway.app';

  const message = await twilioClient.messages.create({
    to,
    from: TWILIO_PHONE_NUMBER,
    body,
    statusCallback: `${apiBaseUrl}/webhook/sms/status`,
  });

  return { sid: message.sid, status: message.status };
}

export async function makeCall(to: string, callerId?: string): Promise<{ sid: string; status: string }> {
  const call = await twilioClient.calls.create({
    to,
    from: TWILIO_PHONE_NUMBER,
    url: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical&Message=Connecting+you+now',
    // Bridges the call to the CRM user's phone
  });

  return { sid: call.sid, status: call.status };
}

export async function getCallStatus(callSid: string): Promise<object> {
  const call = await twilioClient.calls(callSid).fetch();
  return {
    sid: call.sid,
    status: call.status,
    duration: call.duration,
    direction: call.direction,
    from: call.from,
    to: call.to,
    startTime: call.startTime,
    endTime: call.endTime,
  };
}
