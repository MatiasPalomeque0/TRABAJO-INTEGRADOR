import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_ORIGINS: z.string().default('http://localhost:8081'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('techfix'),
  DB_USER: z.string().default('techfix_app'),
  DB_PASSWORD: z.string().default(''),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_DAYS: z.coerce.number().int().positive().default(30),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional().default(''),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  OAUTH_GITHUB_CLIENT_ID: z.string().optional().default(''),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  OAUTH_DISCORD_CLIENT_ID: z.string().optional().default(''),
  OAUTH_DISCORD_CLIENT_SECRET: z.string().optional().default(''),
  MOBILE_OAUTH_REDIRECT_URI: z.string().url().or(z.string().startsWith('techfix://')).default('techfix://oauth/callback')
});

export const env = schema.parse(process.env);
export const allowedOrigins = env.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);

