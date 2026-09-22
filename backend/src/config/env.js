import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_fge_a938df7b29a10294e7b8c0d9f',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'dev_cookie_secret_fge_83b27c6d5e4a1f0',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  engineVersion: process.env.ENGINE_VERSION || '1.0.0',
  sqlitePath: process.env.SQLITE_DATABASE_PATH || './data/financial_guidance.sqlite'
};
