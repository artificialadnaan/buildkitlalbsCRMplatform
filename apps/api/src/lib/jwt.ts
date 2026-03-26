import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@buildkit/shared';
import { requireEnv } from './env.js';

const SECRET = requireEnv('JWT_SECRET');

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
