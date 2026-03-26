import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;

export const twilioClient = twilio(accountSid, authToken);

export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;

export async function sendSms(to: string, body: string): Promise<{ sid: string; status: string }> {
  const message = await twilioClient.messages.create({
    to,
    from: TWILIO_PHONE_NUMBER,
    body,
  });

  return { sid: message.sid, status: message.status };
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
