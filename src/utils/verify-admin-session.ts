import type { Context } from 'koa';

/**
 * Admin-only gate for export / PDF / download routes that use `auth: false`.
 * Accepts ONLY an active Strapi admin-panel session sent as `Authorization: Bearer <token>`,
 * for an active, non-blocked admin whose role is in EXPORT_ALLOWED_ADMIN_ROLES
 * (default: strapi-super-admin). Every allowed request is audit-logged.
 */
export const verifyAdminSession = async (ctx: Context, strapi: any): Promise<boolean> => {
  const header = ctx.request.headers.authorization;
  if (typeof header !== 'string') return false;
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return false;
  const token = parts[1];

  try {
    // Same validation Strapi 5 uses for the admin panel itself (signed token + live session)
    const manager = strapi.sessionManager;
    if (!manager) return false;
    const result = manager('admin').validateAccessToken(token);
    if (!result?.isValid) return false;
    if (!(await manager('admin').isSessionActive(result.payload.sessionId))) return false;

    const rawUserId = result.payload.userId;
    const numericId = Number(rawUserId);
    const adminId = Number.isFinite(numericId) && String(numericId) === String(rawUserId) ? numericId : rawUserId;

    const user = await strapi.db.query('admin::user').findOne({
      where: { id: adminId },
      select: ['id', 'isActive', 'blocked'],
      populate: { roles: { select: ['code'] } },
    });
    if (!user || user.isActive !== true || user.blocked === true) return false;

    const allowedRoles = (process.env.EXPORT_ALLOWED_ADMIN_ROLES || 'strapi-super-admin')
      .split(',').map((r) => r.trim()).filter(Boolean);
    const hasAllowedRole = (user.roles || []).some((r: any) => allowedRoles.includes(r.code));
    if (!hasAllowedRole) {
      strapi.log.warn(`[verifyAdminSession] Admin ID ${adminId} lacks a role allowed to export (${ctx.path}).`);
      return false;
    }

    strapi.log.info(`[AUDIT] Export by Admin ID ${adminId}, Path: ${ctx.path}, Time: ${new Date().toISOString()}`);
    return true;
  } catch (err) {
    strapi.log.warn(`[verifyAdminSession] Verification failed: ${(err as Error).name}`);
    return false;
  }
};

export default verifyAdminSession;