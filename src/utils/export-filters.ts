import type { Context } from 'koa';

const ALLOWED_OPERATORS = new Set([
  '$and', '$or', '$not',
  '$eq', '$eqi', '$ne', '$nei', '$in', '$notIn',
  '$lt', '$lte', '$gt', '$gte', '$between',
  '$contains', '$notContains', '$containsi', '$notContainsi',
  '$startsWith', '$startsWithi', '$endsWith', '$endsWithi',
  '$null', '$notNull',
]);

const MAX_DEPTH = 10;
const MAX_SEARCH_LENGTH = 200;

/**
 * Keeps only real attribute names (walking into relations / media) and known operators from a
 * filters object taken off the query string, so export URLs can't smuggle arbitrary query keys.
 * `model` is null below a scalar attribute, where only operators are valid.
 */
const sanitizeFilters = (strapi: any, model: any | null, value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return undefined;

  if (Array.isArray(value)) {
    const items = value.map((v) => sanitizeFilters(strapi, model, v, depth + 1)).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value === null || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    let childModel: any | null;
    if (key.startsWith('$')) {
      if (!ALLOWED_OPERATORS.has(key)) continue;
      childModel = model;
    } else if (!model) {
      continue;
    } else if (key === 'id' || key === 'documentId') {
      childModel = null;
    } else {
      const attr = model.attributes?.[key];
      if (!attr) continue;
      if (attr.type === 'relation' && attr.target) childModel = strapi.getModel(attr.target) ?? null;
      else if (attr.type === 'media') childModel = strapi.getModel('plugin::upload.file') ?? null;
      else childModel = null;
    }

    const sanitized = sanitizeFilters(strapi, childModel, child, depth + 1);
    if (sanitized !== undefined) out[key] = sanitized;
  }
  return Object.keys(out).length ? out : undefined;
};

/**
 * Combines an export's own filters (date range, source…) with the filters and search text
 * the admin had applied in the Content Manager list view (`filters[...]` and `_q` query
 * params), so an export downloads only the rows currently shown.
 */
export const withListViewFilters = (
  ctx: Context,
  strapi: any,
  uid: string,
  baseFilters: Record<string, unknown>
): { filters?: Record<string, unknown>; _q?: string } => {
  const query = ctx.query as Record<string, unknown>;
  const listFilters = sanitizeFilters(strapi, strapi.getModel(uid), query.filters) as Record<string, unknown> | undefined;

  const parts = [baseFilters, listFilters].filter(
    (f): f is Record<string, unknown> => !!f && Object.keys(f).length > 0
  );
  const filters = parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : { $and: parts };

  const search = typeof query._q === 'string' ? query._q.trim().slice(0, MAX_SEARCH_LENGTH) : '';
  return search ? { filters, _q: search } : { filters };
};
