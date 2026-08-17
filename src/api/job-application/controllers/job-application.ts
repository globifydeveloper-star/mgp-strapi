import type { Context } from 'koa';
import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import PDFDocument from 'pdfkit';

const { ValidationError } = errors;

const verifyAdminSession = async (ctx: Context, strapi: any): Promise<boolean> => {
  // 1. Strapi Admin session middleware user state
  if (ctx.state && (ctx.state.user || ctx.state.adminUser)) {
    return true;
  }

  const authHeader = (ctx.headers.authorization || ctx.headers.Authorization) as string | undefined;
  let token: string | undefined = undefined;

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  if (!token && typeof ctx.query.token === 'string') {
    token = ctx.query.token.trim();
  }
  if (!token && typeof ctx.query.jwt === 'string') {
    token = ctx.query.jwt.trim();
  }

  // Check cookies if token is missing
  if (!token && ctx.cookies) {
    token = ctx.cookies.get('jwtToken') || ctx.cookies.get('admin_jwtToken');
  }

  // 2. Match configured admin API token from env if present
  const envApiToken = process.env.STRAPI_API_TOKEN;
  if (envApiToken && envApiToken.trim() && token && token === envApiToken.trim()) {
    return true;
  }

  if (!token) return false;

  // 3. Try Strapi admin token service for logged-in admin panel session JWT
  try {
    const adminTokenService = strapi.service('admin::token') || strapi.plugin('admin')?.service('token');
    if (adminTokenService && typeof adminTokenService.decodeJWTToken === 'function') {
      const decoded = await adminTokenService.decodeJWTToken(token);
      if (decoded && (decoded.id || decoded.userId)) {
        return true;
      }
    }
  } catch (_) {}

  // 4. Try verifying JWT with ADMIN_JWT_SECRET
  try {
    const jwt = require('jsonwebtoken');
    const secret = process.env.ADMIN_JWT_SECRET || strapi.config.get('admin.auth.secret');
    if (secret) {
      const decoded = jwt.verify(token, secret);
      strapi.log.info('[verifyAdminSession] Decoded token payload:', decoded);
      if (decoded) {
        return true;
      }
    } else {
      strapi.log.warn('[verifyAdminSession] ADMIN_JWT_SECRET is missing or undefined.');
    }
  } catch (err) {
    strapi.log.error('[verifyAdminSession] JWT Verification failed:', err);
  }

  // 5. Try verifying against Strapi API tokens stored in database
  try {
    const apiTokenService = strapi.service('admin::api-token') || strapi.plugin('admin')?.service('api-token');
    if (apiTokenService && typeof apiTokenService.hash === 'function') {
      const hashedToken = apiTokenService.hash(token);
      const tokenRow = await strapi.documents('strapi::api-token').findFirst({
        filters: { accessKey: { $eq: hashedToken } },
      });
      if (tokenRow) return true;
    }
  } catch (_) {}

  return false;
};

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

      let fileUrl = resume.url;
      if (typeof fileUrl === 'string' && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
        let host = (process.env.STRAPI_URL || 'http://localhost:1337').trim();
        if (host.endsWith('/')) {
          host = host.slice(0, -1);
        }
        fileUrl = fileUrl.startsWith('/') ? `${host}${fileUrl}` : `${host}/${fileUrl}`;
      }

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          ctx.status = response.status;
          ctx.body = { error: `Failed to fetch file: ${response.statusText}` };
          return;
        }
        
        ctx.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        ctx.set('Content-Disposition', `attachment; filename="${(resume.name || 'resume').replace(/"/g, '')}${resume.ext || ''}"`);
        
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
        `inline; filename="Application_${(appDoc.fullName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_')}_${appDoc.documentId}.pdf"`
      );
      ctx.body = pdfBuffer;
    },

    async exportBulkPdf(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const apps = (await strapi.documents('api::job-application.job-application').findMany({
        populate: ['jobPosition', 'jobPosition.department', 'resume'],
        sort: { submittedAt: 'desc' },
      })) as any[];

      const pdfBuffer = await createPdfBuffer((doc) => {
        // Header
        doc.fillColor('#0B1536').rect(36, 36, 523, 40).fill();
        doc.fillColor('#EBAF20').fontSize(15).font('Helvetica-Bold').text('MUTHOOT GOLD POINT', 48, 48);
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica').text('Job Applications Summary Export', 330, 50, { align: 'right' });
        doc.moveDown(2.5);

        doc.fillColor('#333333').fontSize(9).font('Helvetica').text(`Total Records: ${apps.length}  |  Export Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`);
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
      ctx.set('Content-Disposition', `inline; filename="Job_Applications_Export_${Date.now()}.pdf"`);
      ctx.body = pdfBuffer;
    },

    async exportBulkCsv(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const apps = (await strapi.documents('api::job-application.job-application').findMany({
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
  })
);
