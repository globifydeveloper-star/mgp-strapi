import type { Context } from 'koa';
import { factories } from '@strapi/strapi';
import PDFDocument from 'pdfkit';

const verifyAdminSession = async (ctx: Context, strapi: any): Promise<boolean> => {
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

  if (!token && ctx.cookies) {
    token = ctx.cookies.get('jwtToken') || ctx.cookies.get('admin_jwtToken');
  }

  const envApiToken = process.env.STRAPI_API_TOKEN;
  if (envApiToken && envApiToken.trim() && token && token === envApiToken.trim()) {
    return true;
  }

  if (!token) return false;

  try {
    const adminTokenService = strapi.service('admin::token') || strapi.plugin('admin')?.service('token');
    if (adminTokenService && typeof adminTokenService.decodeJWTToken === 'function') {
      const decoded = await adminTokenService.decodeJWTToken(token);
      if (decoded && (decoded.id || decoded.userId)) {
        return true;
      }
    }
  } catch (_) {}

  try {
    const jwt = require('jsonwebtoken');
    const secret = process.env.ADMIN_JWT_SECRET || strapi.config.get('admin.auth.secret');
    if (secret) {
      const decoded = jwt.verify(token, secret);
      if (decoded && (decoded.id || decoded.userId)) {
        return true;
      }
    }
  } catch (_) {}

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
  'api::contact-submission.contact-submission',
  ({ strapi }) => ({
    async create(ctx: Context) {
      let body = ctx.request.body;
      if (body && typeof body === 'object' && 'data' in body && body.data && typeof body.data === 'object') {
        body = body.data;
      }

      const service = strapi.service('api::contact-submission.contact-submission') as unknown as {
        submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
      };

      const result = await service.submitAndSync(body);

      ctx.status = 201;
      ctx.body = { data: result };
    },

    async find(ctx: Context) {
      const entries = await strapi.documents('api::contact-submission.contact-submission').findMany({
        sort: { submittedAt: 'desc' },
      });
      ctx.status = 200;
      ctx.body = { data: entries };
    },

    async generateSinglePdf(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { id } = ctx.params;
      const appDoc = (await strapi.documents('api::contact-submission.contact-submission').findFirst({
        filters: {
          $or: [
            { documentId: { $eq: id } },
            { id: { $eq: isNaN(Number(id)) ? -1 : Number(id) } },
          ],
        },
      })) as any;

      if (!appDoc) {
        ctx.status = 404;
        ctx.body = { error: 'Contact submission not found.' };
        return;
      }

      const pdfBuffer = await createPdfBuffer((doc) => {
        // Brand Header
        doc.fillColor('#EBAF20').rect(36, 36, 523, 40).fill();
        doc.fillColor('#0B1536').fontSize(16).font('Helvetica-Bold').text('MUTHOOT GOLD POINT', 48, 48);
        doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica').text('Contact Us Submission Details', 320, 50, { align: 'right' });
        doc.moveDown(2);

        doc.font('Helvetica-Bold').fontSize(18).fillColor('#0B1536').text(appDoc.name || 'Contact Submission');
        doc.font('Helvetica').fontSize(10).fillColor('#666666').text(`Ref ID: ${appDoc.documentId}`);
        doc.text(`Submitted Date: ${appDoc.submittedAt ? new Date(appDoc.submittedAt).toLocaleString() : 'N/A'}`);
        doc.moveDown(1);

        // Section: Contact Details
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#EBAF20').text('1. Contact Details');
        doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('Full Name: ', { continued: true });
        doc.font('Helvetica').text(appDoc.name || 'N/A');

        doc.font('Helvetica-Bold').text('Phone Number: ', { continued: true });
        doc.font('Helvetica').text(appDoc.phone || 'N/A');

        doc.font('Helvetica-Bold').text('Email Address: ', { continued: true });
        doc.font('Helvetica').text(appDoc.email || 'N/A');

        doc.font('Helvetica-Bold').text('Branch / Location: ', { continued: true });
        doc.font('Helvetica').text(appDoc.branch || 'N/A');
        doc.moveDown(1);

        // Section: Message Content
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#EBAF20').text('2. Message Content');
        doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).fillColor('#333333').text(appDoc.message || 'No message content provided.');
        doc.moveDown(1);

        // Section: CRM Integration Info
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#EBAF20').text('3. CRM Integration Status');
        doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(36, doc.y).lineTo(559, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text('CRM Push Status: ', { continued: true });
        doc.font('Helvetica-Bold').fillColor(appDoc.crmPushStatus === 'Sent' ? '#2ECC71' : '#E74C3C').text(appDoc.crmPushStatus || 'Pending');

        if (appDoc.crmLeadId) {
          doc.font('Helvetica-Bold').fillColor('#333333').text('CRM Lead ID: ', { continued: true });
          doc.font('Helvetica').text(appDoc.crmLeadId);
        }

        if (appDoc.crmError) {
          doc.font('Helvetica-Bold').fillColor('#E74C3C').text('CRM Error: ', { continued: true });
          doc.font('Helvetica').text(appDoc.crmError);
        }
      });

      ctx.type = 'application/pdf';
      ctx.set(
        'Content-Disposition',
        `inline; filename="Contact_Submission_${(appDoc.name || 'Contact').replace(/[^a-zA-Z0-9]/g, '_')}_${appDoc.documentId}.pdf"`
      );
      ctx.body = pdfBuffer;
    },

    async exportBulkPdf(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const entries = (await strapi.documents('api::contact-submission.contact-submission').findMany({
        sort: { submittedAt: 'desc' },
      })) as any[];

      const pdfBuffer = await createPdfBuffer((doc) => {
        // Header
        doc.fillColor('#0B1536').rect(36, 36, 523, 40).fill();
        doc.fillColor('#EBAF20').fontSize(15).font('Helvetica-Bold').text('MUTHOOT GOLD POINT', 48, 48);
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica').text('Contact Submissions Export', 330, 50, { align: 'right' });
        doc.moveDown(2.5);

        doc.fillColor('#333333').fontSize(9).font('Helvetica').text(`Total Records: ${entries.length}  |  Export Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`);
        doc.moveDown(0.5);

        const startX = 36;
        let startY = doc.y;

        const drawTableHeader = () => {
          doc.fillColor('#F4F6F8').rect(startX, startY, 523, 20).fill();
          doc.strokeColor('#DCDCDC').lineWidth(0.5).rect(startX, startY, 523, 20).stroke();

          doc.fillColor('#0B1536').fontSize(9).font('Helvetica-Bold');
          doc.text('#', startX + 4, startY + 5, { width: 20 });
          doc.text('Name', startX + 25, startY + 5, { width: 110 });
          doc.text('Phone', startX + 140, startY + 5, { width: 85 });
          doc.text('Email', startX + 230, startY + 5, { width: 120 });
          doc.text('Branch', startX + 355, startY + 5, { width: 85 });
          doc.text('Submitted Date', startX + 445, startY + 5, { width: 75 });

          startY += 20;
        };

        drawTableHeader();

        doc.font('Helvetica').fontSize(8.5);

        entries.forEach((item, idx) => {
          if (startY > 740) {
            doc.addPage();
            startY = 40;
            drawTableHeader();
          }

          const dateStr = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'N/A';
          const bg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';

          doc.fillColor(bg).rect(startX, startY, 523, 22).fill();
          doc.strokeColor('#EEEEEE').lineWidth(0.5).rect(startX, startY, 523, 22).stroke();

          doc.fillColor('#333333');
          doc.text(String(idx + 1), startX + 4, startY + 6, { width: 20 });
          doc.text(item.name || 'N/A', startX + 25, startY + 6, { width: 110, height: 14 });
          doc.text(item.phone || 'N/A', startX + 140, startY + 6, { width: 85, height: 14 });
          doc.text(item.email || 'N/A', startX + 230, startY + 6, { width: 120, height: 14 });
          doc.text(item.branch || 'N/A', startX + 355, startY + 6, { width: 85, height: 14 });
          doc.text(dateStr, startX + 445, startY + 6, { width: 75, height: 14 });

          startY += 22;
        });
      });

      ctx.type = 'application/pdf';
      ctx.set('Content-Disposition', `inline; filename="Contact_Submissions_Export_${Date.now()}.pdf"`);
      ctx.body = pdfBuffer;
    },
  })
);
