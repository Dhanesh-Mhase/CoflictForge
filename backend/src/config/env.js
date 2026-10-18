import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    ACCESS_EXPIRES_IN: '15m',
    REFRESH_EXPIRES_IN: '7d',
    REFRESH_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  },
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

export const validateEnv = () => {
  const missing = [];
  if (!process.env.JWT_ACCESS_SECRET) missing.push('JWT_ACCESS_SECRET');
  if (!process.env.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
  if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');

  if (missing.length > 0) {
    console.warn(`[WARN] Missing recommended environment variables: ${missing.join(', ')}. Using fallbacks for development.`);
  }
};
