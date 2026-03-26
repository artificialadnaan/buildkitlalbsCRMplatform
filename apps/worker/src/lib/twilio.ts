import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;

const twilioClient = twilio(accountSid, authToken);

export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;

export async function sendSms(to: string, body: string): Promise<{ sid: string; status: string }> {
  const message = await twilioClient.messages.create({
    to,
    from: TWILIO_PHONE_NUMBER,
    body,
  });

  return { sid: message.sid, status: message.status };
}
