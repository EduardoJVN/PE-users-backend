import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Leemos el package.json para obtener la versión real
const pkgPath = join(process.cwd(), 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string; name?: string };

const nodeEnv = process.env.NODE_ENV || 'development';
const isTest = nodeEnv === 'test';

const jwtPrivateKey = process.env.JWT_PRIVATE_KEY ?? '';
const jwtPublicKey = process.env.JWT_PUBLIC_KEY ?? '';

if (!isTest) {
  if (!jwtPrivateKey) {
    throw new Error('Missing required environment variable: JWT_PRIVATE_KEY');
  }
  if (!jwtPublicKey) {
    throw new Error('Missing required environment variable: JWT_PUBLIC_KEY');
  }
}

export const ENV = {
  VERSION: pkg.version ?? '0.0.0',
  NODE_ENV: nodeEnv,
  PORT: process.env.PORT ?? 3000,
  APP_NAME: pkg.name ?? 'api-service',
  JWT_PRIVATE_KEY: jwtPrivateKey,
  JWT_PUBLIC_KEY: jwtPublicKey,
};