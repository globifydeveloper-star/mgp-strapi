import type { Context } from 'koa';

export const verifyAdminSession = async (ctx: Context, strapi: any): Promise<boolean> => {
  if (ctx.state && (ctx.state.user || ctx.state.adminUser)) {
    return true;
  }

  const authHeader = (ctx.headers.authorization || ctx.headers.Authorization) as string | undefined;
  let token: string | undefined = undefined;

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  if (!token && typeof ctx.query.token === 'string') {
    token = ctx.query.token.trim();
  }
  if (!token && typeof ctx.query.jwt === 'string') {
    token = ctx.query.jwt.trim();
  }

  if (!token && ctx.cookies) {
    token = ctx.cookies.get('jwtToken') || ctx.cookies.get('admin_jwtToken');
  }

  const envApiToken = process.env.STRAPI_API_TOKEN;
  if (envApiToken && envApiToken.trim() && token && token === envApiToken.trim()) {
    return true;
  }

  if (!token) return false;

  try {
    const adminTokenService = strapi.service('admin::token') || strapi.plugin('admin')?.service('token');
    if (adminTokenService && typeof adminTokenService.decodeJWTToken === 'function') {
      const decoded = await adminTokenService.decodeJWTToken(token);
      if (decoded && (decoded.id || decoded.userId)) {
        return true;
      }
    }
  } catch (_) { }

  try {
    const jwt = require('jsonwebtoken');
    const secret = process.env.ADMIN_JWT_SECRET || strapi.config.get('admin.auth.secret');
    if (secret) {
      const decoded = jwt.verify(token, secret);
      if (decoded) {
        return true;
      }
    } else {
      strapi.log.warn('[verifyAdminSession] ADMIN_JWT_SECRET is missing or undefined.');
    }
  } catch (err) {
    strapi.log.error('[verifyAdminSession] JWT Verification failed:', err);
  }

  try {
    const apiTokenService = strapi.service('admin::api-token') || strapi.plugin('admin')?.service('api-token');
    if (apiTokenService && typeof apiTokenService.hash === 'function') {
      const hashedToken = apiTokenService.hash(token);
      const tokenRow = await strapi.documents('strapi::api-token').findFirst({
        filters: { accessKey: { $eq: hashedToken } },
      });
      if (tokenRow) return true;
    }
  } catch (_) { }

  return false;
};
