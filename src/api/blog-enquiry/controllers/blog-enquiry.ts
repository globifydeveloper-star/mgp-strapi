import type { Context } from 'koa';
import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::blog-enquiry.blog-enquiry',
  ({ strapi }) => ({
    async create(ctx: Context) {
      let body = ctx.request.body;
      if (body && typeof body === 'object' && 'data' in body && body.data && typeof body.data === 'object') {
        body = body.data;
      }

      const service = strapi.service('api::blog-enquiry.blog-enquiry') as unknown as {
        submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
      };

      const result = await service.submitAndSync(body);

      ctx.status = 201;
      ctx.body = { data: result };
    },

    async find(ctx: Context) {
      const entries = await strapi.documents('api::blog-enquiry.blog-enquiry').findMany({
        sort: { submittedAt: 'desc' },
      });
      ctx.status = 200;
      ctx.body = { data: entries };
    },
  })
);
