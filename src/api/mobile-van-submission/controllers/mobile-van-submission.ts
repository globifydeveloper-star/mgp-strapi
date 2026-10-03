import type { Context } from 'koa';
import { factories } from '@strapi/strapi';
import { verifyAdminSession } from '../../../utils/verify-admin-session';
import { enforceRateLimit } from '../../../utils/rate-limit';

export default factories.createCoreController(
  'api::mobile-van-submission.mobile-van-submission',
  ({ strapi }) => ({
    async create(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      // Inject sanitization
      try {
        const { sanitizePayload, validateStringLengths } = require('../../../utils/sanitize-input');
        if (ctx.request.body) {
          if (!validateStringLengths(ctx.request.body)) {
            ctx.status = 400;
            ctx.body = { success: false, message: 'Payload contains strings that are too long' };
            return;
          }
          ctx.request.body = sanitizePayload(ctx.request.body);
        }
      } catch (err) {
        // Ignore if file not found, but it should exist
      }

      if (process.env.REQUIRE_INTERNAL_SECRET === 'true') {
        const secret = ctx.request.headers['x-internal-secret'];
        const expected = process.env.INTERNAL_API_SECRET;
        if (!expected || !secret || typeof secret !== 'string' || secret !== expected) {
          ctx.status = 403;
          ctx.body = { success: false, message: 'Forbidden' };
          return;
        }
      }

      if (enforceRateLimit(ctx, 'mobile-van-submission:create', 5, 10 * 60 * 1000)) return;

      let body = ctx.request.body;
      if (body && typeof body === 'object' && 'data' in body && body.data && typeof body.data === 'object') {
        body = body.data;
      }

      const service = strapi.service('api::mobile-van-submission.mobile-van-submission') as unknown as {
        submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
      };

      await service.submitAndSync(body);

      ctx.status = 201;
      ctx.body = { success: true };
    },

    async find(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const entries = await strapi.documents('api::mobile-van-submission.mobile-van-submission').findMany({
        sort: { submittedAt: 'desc' },
      });
      ctx.status = 200;
      ctx.body = { data: entries };
    },
  })
);
