import type { Context } from 'koa';

export const verifyAdminSession = async (ctx: Context, strapi: any): Promise<boolean> => {
  if (ctx.state && ctx.state.adminUser && (ctx.state.adminUser.isActive || ctx.state.adminUser.is_active)) {
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

  if (!token) return false;

  let adminId: number | null = null;

  try {
    const adminTokenService = strapi.service('admin::token') || strapi.plugin('admin')?.service('token');
    if (adminTokenService && typeof adminTokenService.decodeJWTToken === 'function') {
      const decoded = await adminTokenService.decodeJWTToken(token);
      if (decoded && (decoded.id || decoded.userId)) {
        adminId = decoded.id || decoded.userId;
      }
    }
  } catch (_) { }

  if (!adminId) {
    try {
      const jwt = require('jsonwebtoken');
      const secret = process.env.ADMIN_JWT_SECRET || strapi.config.get('admin.auth.secret');
      if (secret) {
        const decoded = jwt.verify(token, secret) as any;
        if (decoded && decoded.id) {
          adminId = decoded.id;
        }
      } else {
        strapi.log.warn('[verifyAdminSession] ADMIN_JWT_SECRET is missing or undefined.');
      }
    } catch (err) {
      strapi.log.error('[verifyAdminSession] JWT Verification failed:', (err as Error).message);
    }
  }

  if (adminId) {
    try {
      // Must be a real, active admin user (not blocked)
      const user = await strapi.db.connection('admin_users').where('id', adminId).first();
      if (user && (user.is_active === 1 || user.is_active === true) && (user.blocked === 0 || user.blocked === false)) {
        // Verify they have at least one admin role (basic permission check)
        const roles = await strapi.db.connection('admin_users_roles_lnk').where('user_id', adminId);
        if (roles && roles.length > 0) {
          return true;
        }
      }
    } catch (err) {
      strapi.log.error('[verifyAdminSession] Admin verification DB query failed:', err);
    }
  }

  // We intentionally no longer accept generic API tokens (STRAPI_API_TOKEN or strapi::api-token)
  // for these sensitive export routes, as they should only be accessible by actual active admins.
  
  return false;
};
