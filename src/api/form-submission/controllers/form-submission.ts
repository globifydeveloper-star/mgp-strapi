import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';

const { ValidationError } = errors;

export default factories.createCoreController(
  'api::form-submission.form-submission',
  ({ strapi }) => ({
    async create(ctx: Context) {
      const body = ctx.request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('A JSON request body is required.');
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
        sort: { submittedAt: 'desc' },
      });
      ctx.status = 200;
      ctx.body = { data: submissions };
    },
  })
);
