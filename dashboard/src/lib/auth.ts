import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export interface JwtPayload {
  id: number;
  email: string;
  role: 'admin' | 'salesperson';
  name: string;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET não definido. Adicione ao arquivo .env.local antes de iniciar o servidor.'
  );
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '8h' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as JwtPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}
