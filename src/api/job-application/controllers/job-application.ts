import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';

const { ValidationError } = errors;

export default factories.createCoreController(
  'api::job-application.job-application',
  ({ strapi }) => ({
    async create(ctx: Context) {
      const body = ctx.request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ValidationError('A valid JSON request body is required.');
      }

      const { fullName, email, phone, experienceYears, currentCity, coverNote, resume, jobPosition } = body as Record<string, unknown>;

      if (typeof fullName !== 'string' || !fullName.trim()) {
        throw new ValidationError('fullName is required.');
      }
      if (typeof email !== 'string' || !email.trim()) {
        throw new ValidationError('email is required.');
      }
      if (typeof phone !== 'string' || !phone.trim()) {
        throw new ValidationError('phone is required.');
      }

      const application = await strapi.documents('api::job-application.job-application').create({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          experienceYears: typeof experienceYears === 'string' ? experienceYears.trim() : undefined,
          currentCity: typeof currentCity === 'string' ? currentCity.trim() : undefined,
          coverNote: typeof coverNote === 'string' ? coverNote.trim() : undefined,
          resume: typeof resume === 'number' || typeof resume === 'string' ? (resume as any) : undefined,
          jobPosition: typeof jobPosition === 'string' ? (jobPosition as any) : undefined,
          submittedAt: new Date().toISOString(),
        },
      });

      ctx.status = 201;
      ctx.body = {
        data: {
          documentId: application.documentId,
          fullName: application.fullName,
          email: application.email,
          submittedAt: application.submittedAt,
        },
      };
    },
  })
);
