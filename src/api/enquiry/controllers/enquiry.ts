import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';

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
    const enquiry = await enquiryService.createVerifiedEnquiry(body);

    ctx.status = 201;
    ctx.body = { data: enquiry };
  },
}));
