import type { Context } from 'koa';

const CONTENT_MANAGER_READ_ACTION = 'plugin::content-manager.explorer.read';

/**
 * True when one of the roles can read every field of `subject` in the Content Manager with
 * no conditions attached. Exports include every field (email, phone, resume), so a role that
 * is limited to some fields, or to "is creator" entries, must not be able to export.
 */
const rolesCanReadAllFields = async (strapi: any, roleIds: Array<number | string>, subject: string): Promise<boolean> => {
  const model = strapi.contentTypes?.[subject];
  if (!model || roleIds.length === 0) return false;

  const permissions = await strapi.db.query('admin::permission').findMany({
    where: { action: CONTENT_MANAGER_READ_ACTION, subject, role: { id: { $in: roleIds } } },
  });

  const requiredFields: string[] = strapi
    .service('admin::content-type')
    .getNestedFields(model, { components: strapi.components });

  return permissions.some((p: any) => {
    if (Array.isArray(p.conditions) && p.conditions.length > 0) return false;
    const fields = p.properties?.fields;
    if (fields === null || fields === undefined) return true;
    return Array.isArray(fields) && requiredFields.every((f) => fields.includes(f));
  });
};

/**
 * Admin-only gate for export / PDF / download routes that use `auth: false`.
 * Accepts ONLY an active Strapi admin-panel session sent as `Authorization: Bearer <token>`,
 * for an active, non-blocked admin whose role is in EXPORT_ALLOWED_ADMIN_ROLES
 * (default: strapi-super-admin) or, when `subject` is given, whose role has full
 * unconditional read access to that content type (e.g. the HR role for job applications).
 * Every allowed request is audit-logged.
 */
export const verifyAdminSession = async (ctx: Context, strapi: any, subject?: string): Promise<boolean> => {
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
      populate: { roles: { select: ['id', 'code'] } },
    });
    if (!user || user.isActive !== true || user.blocked === true) return false;

    const roles = user.roles || [];
    const allowedRoles = (process.env.EXPORT_ALLOWED_ADMIN_ROLES || 'strapi-super-admin')
      .split(',').map((r) => r.trim()).filter(Boolean);
    const hasAllowedRole =
      roles.some((r: any) => allowedRoles.includes(r.code)) ||
      (!!subject && (await rolesCanReadAllFields(strapi, roles.map((r: any) => r.id), subject)));
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
