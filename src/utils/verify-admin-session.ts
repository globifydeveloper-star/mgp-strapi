import type { Context } from 'koa';

export const verifyAdminSession = async (ctx: Context, strapi: any): Promise<boolean> => {
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
    strapi.log.warn('[verifyAdminSession] JWT Verification failed:', (err as Error).message);
    return false;
  }

  if (adminId) {
    try {
      const user = await strapi.db.connection('admin_users').where('id', adminId).first();
      if (user && (user.is_active === 1 || user.is_active === true) && (user.blocked === 0 || user.blocked === false)) {
        
        const roles = await strapi.db.connection('admin_users_roles_lnk')
          .join('admin_roles', 'admin_users_roles_lnk.role_id', 'admin_roles.id')
          .where('admin_users_roles_lnk.user_id', adminId)
          .select('admin_roles.code');
          
        const allowedRolesConfig = process.env.EXPORT_ALLOWED_ADMIN_ROLES || 'strapi-super-admin';
        const allowedRoles = allowedRolesConfig.split(',').map(r => r.trim());
        
        const hasAllowedRole = roles.some((r: any) => allowedRoles.includes(r.code));
        
        if (hasAllowedRole) {
          strapi.log.info(`[AUDIT] Export triggered by Admin ID: ${adminId}, Path: ${ctx.path}, Timestamp: ${new Date().toISOString()}`);
          return true;
        } else {
          strapi.log.warn(`[verifyAdminSession] Admin ID: ${adminId} does not have required role for export.`);
        }
      }
    } catch (err) {
      strapi.log.error('[verifyAdminSession] Admin verification DB query failed:', err);
    }
  }

  return false;
};
