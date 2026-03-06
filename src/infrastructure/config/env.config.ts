import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const pkgPath = join(process.cwd(), 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string; name?: string };

const isTest = process.env.NODE_ENV === 'test';

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  JWT_PRIVATE_KEY: isTest ? z.string().default('') : z.string().min(1),
  JWT_PUBLIC_KEY: isTest ? z.string().default('') : z.string().min(1),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  HOST: z.string().default('localhost'),
  DATABASE_URL: isTest ? z.string().default('') : z.string().min(1),
  DIRECT_URL: isTest ? z.string().default('') : z.string().min(1),
  RESEND_API_KEY: isTest ? z.string().default('') : z.string().min(1),
  RESEND_FROM_EMAIL: isTest ? z.string().default('') : z.string().email(),
  FRONTEND_URL: isTest ? z.string().default('') : z.string().url(),
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  const field = String(result.error.issues[0].path[0]);
  throw new Error(`Missing required environment variable: ${field}`);
}

export const ENV = {
  VERSION: pkg.version ?? '0.0.0',
  APP_NAME: pkg.name ?? 'api-service',
  NODE_ENV: result.data.NODE_ENV,
  PORT: result.data.PORT,
  HOST: result.data.HOST,
  JWT_PRIVATE_KEY: result.data.JWT_PRIVATE_KEY,
  JWT_PUBLIC_KEY: result.data.JWT_PUBLIC_KEY,
  REFRESH_TOKEN_TTL_DAYS: result.data.REFRESH_TOKEN_TTL_DAYS,
  DATABASE_URL: result.data.DATABASE_URL,
  DIRECT_URL: result.data.DIRECT_URL,
  RESEND_API_KEY: result.data.RESEND_API_KEY,
  RESEND_FROM_EMAIL: result.data.RESEND_FROM_EMAIL,
  FRONTEND_URL: result.data.FRONTEND_URL,
};
