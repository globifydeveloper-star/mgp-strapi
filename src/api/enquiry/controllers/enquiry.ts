import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { enforceRateLimit } from '../../../utils/rate-limit';

const { ValidationError } = errors;

export default factories.createCoreController('api::enquiry.enquiry', ({ strapi }) => ({
  async find(ctx: Context) {
    ctx.query = {
      ...ctx.query,
      sort: ctx.query.sort || { createdAt: 'desc' },
    };
    return await super.find(ctx);
  },

  async create(ctx: Context) {

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

    if (enforceRateLimit(ctx, 'enquiry:create', 5, 10 * 60 * 1000)) return;

    let body = ctx.request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('A JSON request body is required.');
    }
    if ('data' in body && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      body = body.data;
    }

    const enquiryService = strapi.service('api::enquiry.enquiry') as unknown as {
      createVerifiedEnquiry(payload: unknown): Promise<Record<string, unknown>>;
    };
    await enquiryService.createVerifiedEnquiry(body);

    ctx.status = 201;
    ctx.body = { success: true };
  },
}));
