import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { enforceRateLimit } from '../../../utils/rate-limit';
import { verifyAdminSession } from '../../../utils/verify-admin-session';

const { ValidationError } = errors;

const createPdfBuffer = (builder: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));
      builder(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * BE-16: resume PDFs in S3 are blocked for anonymous requests by the bucket policy.
 * Returns a short-lived presigned URL signed with the upload provider's own credentials
 * (the IAM user exempted in the bucket policy). Falls back to the stored URL for the
 * local provider or files that are not in the bucket.
 */
const resolveResumeFetchUrl = async (strapi: any, file: any): Promise<string> => {
  let fileUrl = String(file.url);
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    let host = (process.env.STRAPI_URL || 'http://localhost:1337').trim();
    if (host.endsWith('/')) host = host.slice(0, -1);
    return fileUrl.startsWith('/') ? `${host}${fileUrl}` : `${host}/${fileUrl}`;
  }

  const provider = strapi.plugin('upload')?.provider;
  if (provider && typeof provider.getSignedUrl === 'function') {
    try {
      const signed = await provider.getSignedUrl(file);
      if (signed && typeof signed.url === 'string' && signed.url) return signed.url;
    } catch (err) {
      strapi.log.error(`[job-application] Could not sign resume URL: ${(err as Error).name}`);
    }
  }
  return fileUrl;
};

interface NewApplicationDetails {
  fullName: string;
  email: string;
  phone: string;
  experienceYears?: string;
  currentCity?: string;
  jobPositionTitle?: string;
}

const notifyHrOfNewApplication = async (strapi: any, details: NewApplicationDetails): Promise<void> => {
  const hrEmail = process.env.HR_NOTIFICATION_EMAIL;
  if (!hrEmail) {
    strapi.log.warn('[job-application] HR_NOTIFICATION_EMAIL is not set; skipping HR notification email.');
    return;
  }

  const roleStr = details.jobPositionTitle || 'Not specified';

  try {
    await strapi.plugin('email').service('email').send({
      to: hrEmail,
      subject: `New Job Application: ${details.fullName} (${roleStr})`,
      text: [
        'A new job application has been submitted.',
        '',
        `Name: ${details.fullName}`,
        `Email: ${details.email}`,
        `Phone: ${details.phone}`,
        `Position Applied For: ${roleStr}`,
        `Experience: ${details.experienceYears || 'N/A'}`,
        `Current City: ${details.currentCity || 'N/A'}`,
        '',
        'Log in to the Strapi admin panel to review the full application and resume.',
      ].join('\n'),
    });
  } catch (err) {
    strapi.log.error('[job-application] Failed to send HR notification email:', err);
  }
};

export default factories.createCoreController(
  'api::job-application.job-application',
  ({ strapi }) => ({
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

      if (enforceRateLimit(ctx, 'job-application:create', 5, 10 * 60 * 1000)) return;

      let body = ctx.request.body ?? {};

      // Handle wrapped body.data if present
      if (typeof body === 'object' && body !== null && 'data' in body && body.data) {
        if (typeof body.data === 'string') {
          try {
            body = JSON.parse(body.data);
          } catch (_) {
            body = body.data;
          }
        } else if (typeof body.data === 'object') {
          body = body.data;
        }
      } else if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (_) { }
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
      let uploadedFile = files?.resume || files?.file || files?.['files.resume'];
      if (!uploadedFile && files) {
        const fileValues = Object.values(files);
        if (fileValues.length === 1) {
          uploadedFile = fileValues[0];
        }
      }

      if (uploadedFile) {
        try {
          const uploadService = strapi.plugin('upload').service('upload');
          const uploaded = await uploadService.upload({
            data: {},
            files: uploadedFile,
          });
          const fileEntry = Array.isArray(uploaded) ? uploaded[0] : uploaded;
          if (fileEntry) {
            resumeMediaId = fileEntry.id;
          }
        } catch (uploadErr) {
          strapi.log.error('[job-application] Failed to upload resume file:', uploadErr);
          throw new ValidationError('Failed to upload resume file. Please try again.');
        }
      }

      let resolvedJobPositionDocId: string | undefined = undefined;
      let resolvedJobPositionTitle: string | undefined = undefined;
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
            resolvedJobPositionTitle = posDoc.title ?? undefined;
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

      await strapi.documents('api::job-application.job-application').create({
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

      await notifyHrOfNewApplication(strapi, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        experienceYears: typeof experienceYears === 'string' ? experienceYears.trim() : undefined,
        currentCity: typeof currentCity === 'string' ? currentCity.trim() : undefined,
        jobPositionTitle: resolvedJobPositionTitle,
      });

      ctx.status = 201;
      ctx.body = { success: true };
    },

    async downloadResume(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { id } = ctx.params;
      const appDoc = await strapi.documents('api::job-application.job-application').findFirst({
        filters: {
          $or: [
            { documentId: { $eq: id } },
            { id: { $eq: isNaN(Number(id)) ? -1 : Number(id) } },
          ],
        },
        populate: ['resume'],
      });

      if (!appDoc) {
        ctx.status = 404;
        ctx.body = { error: 'Job application not found.' };
        return;
      }

      const resume = appDoc.resume as any;
      if (!resume || !resume.url) {
        ctx.status = 404;
        ctx.body = { error: 'No resume file attached to this job application.' };
        return;
      }

      try {
        const fileUrl = await resolveResumeFetchUrl(strapi, resume);
        const response = await fetch(fileUrl);
        if (!response.ok) {
          strapi.log.error(`[job-application] Resume fetch returned ${response.status} for ${appDoc.documentId}`);
          ctx.status = 502;
          ctx.body = { error: 'Failed to retrieve the resume file from storage.' };
          return;
        }

        const extension = typeof resume.ext === 'string' ? resume.ext : '';
        let filename = String(resume.name || `resume${extension}`).replace(/[\r\n]/g, '');
        if (extension && !filename.toLowerCase().endsWith(extension.toLowerCase())) {
          filename += extension;
        }

        ctx.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        ctx.set('Cache-Control', 'private, no-store');
        ctx.set('X-Content-Type-Options', 'nosniff');
        ctx.attachment(filename);

        const { Readable } = require('stream');
        ctx.body = Readable.fromWeb(response.body);
      } catch (err) {
        strapi.log.error('[job-application] Failed to stream resume:', err);
        ctx.status = 500;
        ctx.body = { error: 'Failed to retrieve the resume file from storage.' };
      }
    },

    async generateSinglePdf(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { id } = ctx.params;
      const appDoc = (await strapi.documents('api::job-application.job-application').findFirst({
        filters: {
          $or: [
            { documentId: { $eq: id } },
            { id: { $eq: isNaN(Number(id)) ? -1 : Number(id) } },
          ],
        },
        populate: ['jobPosition', 'jobPosition.department', 'resume'],
      })) as any;

      if (!appDoc) {
        ctx.status = 404;
        ctx.body = { error: 'Job application not found.' };
        return;
      }

      const jobPos = appDoc.jobPosition || {};
      const dept = jobPos.department || {};
      const resume = appDoc.resume || {};

      const pdfBuffer = await createPdfBuffer((doc) => {
        // Brand Header
        doc.fillColor('#EBAF20').rect(36, 36, 523, 40).fill();
        doc.fillColor('#0B1536').fontSize(16).font('Helvetica-Bold').text('MUTHOOT GOLD POINT', 48, 48);
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica').text('Job Application Details', 360, 50, { align: 'right' });
        doc.moveDown(2);

        doc.font('Helvetica-Bold').fontSize(18).fillColor('#0B1536').text(appDoc.fullName || 'Applicant Details');
        doc.font('Helvetica').fontSize(10).fillColor('#666666').text(`Application Ref ID: ${appDoc.documentId}`);
        doc.text(`Submitted Date: ${appDoc.submittedAt ? new Date(appDoc.submittedAt).toLocaleString() : 'N/A'}`);
        doc.moveDown(1);

        // Section: Personal Information
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#EBAF20').text('1. Personal Information');
        doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Full Name: ', { continued: true });
        doc.font('Helvetica').text(appDoc.fullName || 'N/A');

        doc.font('Helvetica-Bold').text('Email Address: ', { continued: true });
        doc.font('Helvetica').text(appDoc.email || 'N/A');

        doc.font('Helvetica-Bold').text('Phone Number: ', { continued: true });
        doc.font('Helvetica').text(appDoc.phone || 'N/A');

        doc.font('Helvetica-Bold').text('Current City: ', { continued: true });
        doc.font('Helvetica').text(appDoc.currentCity || 'N/A');

        doc.font('Helvetica-Bold').text('Experience: ', { continued: true });
        doc.font('Helvetica').text(appDoc.experienceYears ? `${appDoc.experienceYears} Years` : 'N/A');
        doc.moveDown(1);

        // Section: Position Details
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#EBAF20').text('2. Position & Status');
        doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Applied Role / Position: ', { continued: true });
        doc.font('Helvetica').text(jobPos.title || 'N/A');

        doc.font('Helvetica-Bold').text('Department: ', { continued: true });
        doc.font('Helvetica').text(dept.name || 'N/A');

        doc.font('Helvetica-Bold').text('Application Status: ', { continued: true });
        doc.font('Helvetica-Bold').fillColor('#0B1536').text(appDoc.applicationStatus || 'New');
        doc.moveDown(1);

        // Section: Cover Note
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#EBAF20').text('3. Cover Note / Message');
        doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).fillColor('#333333').text(appDoc.coverNote || 'No cover note provided.');
        doc.moveDown(1);

        // Section: Resume Attachment Reference
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#EBAF20').text('4. Resume Reference');
        doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Resume File: ', { continued: true });
        doc.font('Helvetica').text(resume.name || 'No resume uploaded');

        doc.font('Helvetica-Bold').text('File Format: ', { continued: true });
        doc.font('Helvetica').text(resume.ext ? resume.ext.toUpperCase() : (resume.mime || 'N/A'));

        doc.font('Helvetica-Bold').text('Resume Reference Note: ', { continued: true });
        doc.font('Helvetica').text(
          resume.url
            ? 'Resume attached separately. Click "Download Resume" in the Strapi Admin Panel to view the original file.'
            : 'No resume file attached.'
        );
      });

      ctx.type = 'application/pdf';
      ctx.set(
        'Content-Disposition',
        `attachment; filename="Application_${(appDoc.fullName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_')}_${appDoc.documentId}.pdf"`
      );
      ctx.body = pdfBuffer;
    },

    async exportBulkPdf(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { fromDate, toDate, from, to } = ctx.query as { fromDate?: string; toDate?: string; from?: string; to?: string };
      const start = fromDate || from;
      const end = toDate || to;

      const filters: Record<string, unknown> = {};
      if (start || end) {
        const dateFilter: Record<string, unknown> = {};
        if (start) {
          dateFilter['$gte'] = start.includes('T') ? start : `${start}T00:00:00.000Z`;
        }
        if (end) {
          dateFilter['$lte'] = end.includes('T') ? end : `${end}T23:59:59.999Z`;
        }
        filters['submittedAt'] = dateFilter;
      }

      const apps = (await strapi.documents('api::job-application.job-application').findMany({
        filters: Object.keys(filters).length ? filters : undefined,
        populate: ['jobPosition', 'jobPosition.department', 'resume'],
        sort: { submittedAt: 'desc' },
      })) as any[];

      const pdfBuffer = await createPdfBuffer((doc) => {
        // Header
        doc.fillColor('#0B1536').rect(36, 36, 523, 40).fill();
        doc.fillColor('#EBAF20').fontSize(15).font('Helvetica-Bold').text('MUTHOOT GOLD POINT', 48, 48);
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica').text('Job Applications Summary Export', 330, 50, { align: 'right' });
        doc.moveDown(2.5);

        const rangeStr = start && end ? `  |  Range: ${start} to ${end}` : start ? `  |  From: ${start}` : end ? `  |  To: ${end}` : '';
        doc.fillColor('#333333').fontSize(9).font('Helvetica').text(`Total Records: ${apps.length}${rangeStr}  |  Export Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`);
        doc.moveDown(0.5);

        // Table Column Widths
        const startX = 36;
        let startY = doc.y;

        const drawTableHeader = () => {
          doc.fillColor('#F4F6F8').rect(startX, startY, 523, 20).fill();
          doc.strokeColor('#DCDCDC').lineWidth(0.5).rect(startX, startY, 523, 20).stroke();

          doc.fillColor('#0B1536').fontSize(9).font('Helvetica-Bold');
          doc.text('#', startX + 4, startY + 5, { width: 20 });
          doc.text('Name', startX + 25, startY + 5, { width: 110 });
          doc.text('Role', startX + 140, startY + 5, { width: 100 });
          doc.text('Department', startX + 245, startY + 5, { width: 90 });
          doc.text('Status', startX + 340, startY + 5, { width: 60 });
          doc.text('Applied Date', startX + 405, startY + 5, { width: 70 });
          doc.text('Resume', startX + 480, startY + 5, { width: 40 });

          startY += 20;
        };

        drawTableHeader();

        doc.font('Helvetica').fontSize(8.5);

        apps.forEach((app, idx) => {
          if (startY > 740) {
            doc.addPage();
            startY = 40;
            drawTableHeader();
          }

          const roleStr = app.jobPosition?.title || 'N/A';
          const deptStr = app.jobPosition?.department?.name || 'N/A';
          const statusStr = app.applicationStatus || 'New';
          const dateStr = app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A';
          const hasResume = app.resume ? 'Yes' : 'No';

          const bg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
          doc.fillColor(bg).rect(startX, startY, 523, 22).fill();
          doc.strokeColor('#EEEEEE').lineWidth(0.5).rect(startX, startY, 523, 22).stroke();

          doc.fillColor('#333333');
          doc.text(String(idx + 1), startX + 4, startY + 6, { width: 20 });
          doc.text(app.fullName || 'N/A', startX + 25, startY + 6, { width: 110, height: 14 });
          doc.text(roleStr, startX + 140, startY + 6, { width: 100, height: 14 });
          doc.text(deptStr, startX + 245, startY + 6, { width: 90, height: 14 });
          doc.text(statusStr, startX + 340, startY + 6, { width: 60, height: 14 });
          doc.text(dateStr, startX + 405, startY + 6, { width: 70, height: 14 });
          doc.text(hasResume, startX + 480, startY + 6, { width: 40, height: 14 });

          startY += 22;
        });
      });

      ctx.type = 'application/pdf';
      ctx.set('Content-Disposition', `attachment; filename="Job_Applications_Export_${Date.now()}.pdf"`);
      ctx.body = pdfBuffer;
    },

    async exportBulkCsv(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { fromDate, toDate, from, to } = ctx.query as { fromDate?: string; toDate?: string; from?: string; to?: string };
      const start = fromDate || from;
      const end = toDate || to;

      const filters: Record<string, unknown> = {};
      if (start || end) {
        const dateFilter: Record<string, unknown> = {};
        if (start) {
          dateFilter['$gte'] = start.includes('T') ? start : `${start}T00:00:00.000Z`;
        }
        if (end) {
          dateFilter['$lte'] = end.includes('T') ? end : `${end}T23:59:59.999Z`;
        }
        filters['submittedAt'] = dateFilter;
      }

      const apps = (await strapi.documents('api::job-application.job-application').findMany({
        filters: Object.keys(filters).length ? filters : undefined,
        populate: ['jobPosition', 'jobPosition.department', 'resume'],
        sort: { submittedAt: 'desc' },
      })) as any[];

      const escapeCsv = (str: string) => {
        if (str === null || str === undefined) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };

      const header = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Department', 'Status', 'Applied Date', 'Has Resume'];
      const rows = apps.map((app) => [
        escapeCsv(app.documentId),
        escapeCsv(app.fullName),
        escapeCsv(app.email),
        escapeCsv(app.phone),
        escapeCsv(app.jobPosition?.title || ''),
        escapeCsv(app.jobPosition?.department?.name || ''),
        escapeCsv(app.applicationStatus || 'New'),
        escapeCsv(app.submittedAt ? new Date(app.submittedAt).toISOString() : ''),
        escapeCsv(app.resume ? 'Yes' : 'No'),
      ]);

      const csvContent = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');

      ctx.type = 'text/csv';
      ctx.set('Content-Disposition', `attachment; filename="Job_Applications_Export_${Date.now()}.csv"`);
      ctx.body = csvContent;
    },

    async exportBulkZip(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { fromDate, toDate, from, to } = ctx.query as { fromDate?: string; toDate?: string; from?: string; to?: string };
      const start = fromDate || from;
      const end = toDate || to;

      const filters: Record<string, unknown> = {};
      if (start || end) {
        const dateFilter: Record<string, unknown> = {};
        if (start) {
          dateFilter['$gte'] = start.includes('T') ? start : `${start}T00:00:00.000Z`;
        }
        if (end) {
          dateFilter['$lte'] = end.includes('T') ? end : `${end}T23:59:59.999Z`;
        }
        filters['submittedAt'] = dateFilter;
      }

      const apps = (await strapi.documents('api::job-application.job-application').findMany({
        filters: Object.keys(filters).length ? filters : undefined,
        populate: ['resume'],
      })) as any[];

      const { ZipArchive } = await import('archiver');
      const archive = new ZipArchive({ zlib: { level: 9 } });
      const stream = new PassThrough();
      archive.pipe(stream);

      ctx.type = 'application/zip';
      ctx.set('Content-Disposition', `attachment; filename="Job_Applications_Resumes_${Date.now()}.zip"`);
      ctx.body = stream;

      // Run the loop in the background so Koa can start piping the stream immediately,
      // avoiding backpressure deadlocks where the stream fills up and waits forever.
      (async () => {
        try {
          for (const app of apps) {
            const resume = app.resume;
            if (resume && resume.url) {
              try {
                const fileUrl = await resolveResumeFetchUrl(strapi, resume);
                const response = await fetch(fileUrl);
                if (!response.ok) {
                  strapi.log.error(`[job-application] Resume fetch returned ${response.status} for ${app.documentId}`);
                }
                if (response.ok) {
                  const extension = typeof resume.ext === 'string' ? resume.ext : '';
                  let filename = String(resume.name || `resume${extension}`).replace(/[\r\n]/g, '');
                  if (extension && !filename.toLowerCase().endsWith(extension.toLowerCase())) {
                    filename += extension;
                  }
                  const cleanName = (app.fullName || 'Applicant').replace(/[^a-zA-Z0-9]/g, '_');
                  const finalName = `${app.documentId}_${cleanName}/${filename}`;

                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  archive.append(buffer, { name: finalName });
                }
              } catch (err) {
                strapi.log.error(`[job-application] Failed to fetch resume for app ${app.documentId}:`, err);
              }
            }
          }
        } finally {
          archive.finalize();
        }
      })();
    },
  })
);