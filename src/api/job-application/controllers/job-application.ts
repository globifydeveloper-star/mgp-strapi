import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';

const { ValidationError } = errors;

export default factories.createCoreController(
  'api::job-application.job-application',
  ({ strapi }) => ({
    async create(ctx: Context) {
      let body = ctx.request.body ?? {};
      
      // Handle wrapped body.data if present
      if (typeof body === 'object' && body !== null && 'data' in body && body.data && typeof body.data === 'object') {
        body = body.data;
      }
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (_) {}
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

      let resumeMediaId: number | string | undefined =
        typeof resume === 'number' || typeof resume === 'string' ? resume : undefined;

      // Check if file was uploaded via multipart/form-data
      const files = ctx.request.files as Record<string, any> | undefined;
      const uploadedFile = files?.resume || files?.file || files?.['files.resume'];

      if (uploadedFile) {
        try {
          const uploadService = strapi.plugin('upload').service('upload');
          const uploaded = await uploadService.upload({
            data: {},
            files: uploadedFile,
          });
          const fileEntry = Array.isArray(uploaded) ? uploaded[0] : uploaded;
          if (fileEntry) {
            resumeMediaId = fileEntry.id ?? fileEntry.documentId;
          }
        } catch (uploadErr) {
          strapi.log.error('[job-application] Failed to upload resume file:', uploadErr);
        }
      }

      let resolvedJobPositionDocId: string | undefined = undefined;
      let finalCoverNote = typeof coverNote === 'string' ? coverNote.trim() : undefined;

      if (typeof jobPosition === 'string' && jobPosition.trim()) {
        const inputVal = jobPosition.trim();
        try {
          const posDoc = await strapi.documents('api::job-position.job-position').findFirst({
            filters: {
              $or: [
                { documentId: { $eq: inputVal } },
                { title: { $eq: inputVal } },
              ],
            },
          });
          if (posDoc) {
            resolvedJobPositionDocId = posDoc.documentId;
          } else {
            // Append general position title to cover note so info isn't lost
            finalCoverNote = finalCoverNote
              ? `[Position: ${inputVal}]\n\n${finalCoverNote}`
              : `[Position: ${inputVal}]`;
          }
        } catch (err) {
          strapi.log.warn('[job-application] Could not resolve job position relation:', err);
        }
      }

      const application = await strapi.documents('api::job-application.job-application').create({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          experienceYears: typeof experienceYears === 'string' ? experienceYears.trim() : undefined,
          currentCity: typeof currentCity === 'string' ? currentCity.trim() : undefined,
          coverNote: finalCoverNote,
          resume: resumeMediaId as any,
          jobPosition: resolvedJobPositionDocId as any,
          submittedAt: new Date().toISOString(),
          applicationStatus: 'New',
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
