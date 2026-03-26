export type UserRole = 'admin' | 'rep';
export type CompanyType = 'local' | 'construction';
export type CompanySource = 'scraped' | 'manual';
export type DealStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'email' | 'call' | 'text' | 'note' | 'meeting';

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}
