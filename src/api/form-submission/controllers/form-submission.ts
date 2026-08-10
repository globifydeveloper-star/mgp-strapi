import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';

const { ValidationError } = errors;

export default factories.createCoreController(
  'api::form-submission.form-submission',
  ({ strapi }) => ({
    async create(ctx: Context) {
      let body = ctx.request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('A JSON request body is required.');
      }
      if ('data' in body && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
        body = body.data;
      }

      const service = strapi.service('api::form-submission.form-submission') as unknown as {
        submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
      };

      const result = await service.submitAndSync(body);

      ctx.status = 201;
      ctx.body = { data: result };
    },

    async find(ctx: Context) {
      const submissions = await strapi.documents('api::form-submission.form-submission').findMany({
        sort: ['submittedAt:desc', 'createdAt:desc'],
      });
      ctx.status = 200;
      ctx.body = { data: submissions };
    },
  })
);
