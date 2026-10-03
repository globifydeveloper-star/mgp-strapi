import type { Context } from 'koa';
import { factories } from '@strapi/strapi';
import PDFDocument from 'pdfkit';
import { verifyAdminSession } from '../../../utils/verify-admin-session';
import { enforceRateLimit } from '../../../utils/rate-limit';

const FORM_SOURCE_LABELS: Record<string, string> = {
  'Contact Submission': 'Contact Us',
  'Gold Rate Check': 'Gold Rate Check',
  'Mobile Van': 'Mobile Van',
  'Blog Enquiry': 'Blog Enquiry',
  'Enquiry': 'Enquiry',
};

const createPdfBuffer = (builder: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      builder(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });

export default factories.createCoreController(
  'api::all-lead.all-lead',
  ({ strapi }) => ({

    async create(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

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

      if (enforceRateLimit(ctx, 'all-lead:create', 5, 10 * 60 * 1000)) return;
      await super.create(ctx);
      ctx.body = { success: true };
    },

    async find(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { source, fromDate, toDate, from, to } = ctx.query as { source?: string; fromDate?: string; toDate?: string; from?: string; to?: string };
      const start = fromDate || from;
      const end = toDate || to;
      const filters: Record<string, unknown> = {};
      if (source && typeof source === 'string') {
        filters['formSource'] = { $eq: source };
      }
      if (start || end) {
        const dateFilter: Record<string, unknown> = {};
        if (start) dateFilter['$gte'] = start.includes('T') ? start : `${start}T00:00:00.000Z`;
        if (end) dateFilter['$lte'] = end.includes('T') ? end : `${end}T23:59:59.999Z`;
        filters['submittedAt'] = dateFilter;
      }

      const entries = await strapi.documents('api::all-lead.all-lead').findMany({
        filters: Object.keys(filters).length ? filters : undefined,
        sort: { submittedAt: 'desc' },
      });

      ctx.status = 200;
      ctx.body = { data: entries };
    },

    async exportBulkCsv(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { source, fromDate, toDate, from, to } = ctx.query as { source?: string; fromDate?: string; toDate?: string; from?: string; to?: string };
      const start = fromDate || from;
      const end = toDate || to;
      const filters: Record<string, unknown> = {};
      if (source && typeof source === 'string') {
        filters['formSource'] = { $eq: source };
      }
      if (start || end) {
        const dateFilter: Record<string, unknown> = {};
        if (start) dateFilter['$gte'] = start.includes('T') ? start : `${start}T00:00:00.000Z`;
        if (end) dateFilter['$lte'] = end.includes('T') ? end : `${end}T23:59:59.999Z`;
        filters['submittedAt'] = dateFilter;
      }

      const entries = (await strapi.documents('api::all-lead.all-lead').findMany({
        filters: Object.keys(filters).length ? filters : undefined,
        sort: { submittedAt: 'desc' },
      })) as any[];

      const escapeCsv = (str: unknown) => {
        if (str === null || str === undefined) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };

      const header = [
        'ID',
        'Name',
        'Phone',
        'Email',
        'Form Source',
        'Source Detail',
        'Branch',
        'Branch Code',
        'CRM Status',
        'CRM Lead ID',
        'CRM Error',
        'Submitted Date',
      ];

      const rows = entries.map((item) => [
        escapeCsv(item.documentId),
        escapeCsv(item.name),
        escapeCsv(item.phone),
        escapeCsv(item.email),
        escapeCsv(item.formSource),
        escapeCsv(item.sourceFormDetail),
        escapeCsv(item.branch),
        escapeCsv(item.branchCode),
        escapeCsv(item.crmPushStatus ?? 'Pending'),
        escapeCsv(item.crmLeadId),
        escapeCsv(item.crmError),
        escapeCsv(item.submittedAt ? new Date(item.submittedAt).toISOString() : ''),
      ]);

      const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const label = source ? `_${source.replace(/\s+/g, '_')}` : '';

      ctx.type = 'text/csv';
      ctx.set('Content-Disposition', `attachment; filename="All_Leads${label}_Export_${Date.now()}.csv"`);
      ctx.body = csvContent;
    },

    async exportBulkPdf(ctx: Context) {
      if (!(await verifyAdminSession(ctx, strapi))) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden: Admin authentication required.' };
        return;
      }

      const { source, fromDate, toDate, from, to } = ctx.query as { source?: string; fromDate?: string; toDate?: string; from?: string; to?: string };
      const start = fromDate || from;
      const end = toDate || to;
      const filters: Record<string, unknown> = {};
      if (source && typeof source === 'string') {
        filters['formSource'] = { $eq: source };
      }
      if (start || end) {
        const dateFilter: Record<string, unknown> = {};
        if (start) dateFilter['$gte'] = start.includes('T') ? start : `${start}T00:00:00.000Z`;
        if (end) dateFilter['$lte'] = end.includes('T') ? end : `${end}T23:59:59.999Z`;
        filters['submittedAt'] = dateFilter;
      }

      const entries = (await strapi.documents('api::all-lead.all-lead').findMany({
        filters: Object.keys(filters).length ? filters : undefined,
        sort: { submittedAt: 'desc' },
      })) as any[];

      const label = source ? ` — ${FORM_SOURCE_LABELS[source] ?? source}` : ' (All Forms)';

      const pdfBuffer = await createPdfBuffer((doc) => {
        // Header banner
        doc.fillColor('#0B1536').rect(36, 36, 523, 40).fill();
        doc.fillColor('#EBAF20').fontSize(15).font('Helvetica-Bold').text('MUTHOOT GOLD POINT', 48, 48);
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica').text(`All Leads Export${label}`, 320, 50, { align: 'right' });
        doc.moveDown(2.5);

        doc
          .fillColor('#333333')
          .fontSize(9)
          .font('Helvetica')
          .text(
            `Total Records: ${entries.length}  |  Export Date: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
          );
        doc.moveDown(0.5);

        const startX = 36;
        let startY = doc.y;

        const colWidths = { no: 20, name: 95, phone: 80, email: 105, source: 90, branch: 70, date: 63 };

        const drawHeader = () => {
          doc.fillColor('#F4F6F8').rect(startX, startY, 523, 20).fill();
          doc.strokeColor('#DCDCDC').lineWidth(0.5).rect(startX, startY, 523, 20).stroke();
          doc.fillColor('#0B1536').fontSize(8.5).font('Helvetica-Bold');

          let x = startX + 4;
          doc.text('#', x, startY + 5, { width: colWidths.no });
          x += colWidths.no + 1;
          doc.text('Name', x, startY + 5, { width: colWidths.name });
          x += colWidths.name + 1;
          doc.text('Phone', x, startY + 5, { width: colWidths.phone });
          x += colWidths.phone + 1;
          doc.text('Email', x, startY + 5, { width: colWidths.email });
          x += colWidths.email + 1;
          doc.text('Form Source', x, startY + 5, { width: colWidths.source });
          x += colWidths.source + 1;
          doc.text('Branch', x, startY + 5, { width: colWidths.branch });
          x += colWidths.branch + 1;
          doc.text('Submitted', x, startY + 5, { width: colWidths.date });
          startY += 20;
        };

        drawHeader();
        doc.font('Helvetica').fontSize(8);

        entries.forEach((item, idx) => {
          if (startY > 740) {
            doc.addPage();
            startY = 40;
            drawHeader();
          }

          const dateStr = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-IN') : 'N/A';
          const bg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';

          // Source badge colour
          const sourceBg: Record<string, string> = {
            'Contact Submission': '#EBF5FB',
            'Gold Rate Check': '#FEF9E7',
            'Mobile Van': '#EAFAF1',
            'Blog Enquiry': '#F5EEF8',
            'Enquiry': '#FDFEFE',
          };

          doc.fillColor(bg).rect(startX, startY, 523, 22).fill();
          doc.strokeColor('#EEEEEE').lineWidth(0.5).rect(startX, startY, 523, 22).stroke();

          doc.fillColor('#333333');
          let x = startX + 4;
          doc.text(String(idx + 1), x, startY + 6, { width: colWidths.no });
          x += colWidths.no + 1;
          doc.text(item.name || 'N/A', x, startY + 6, { width: colWidths.name, height: 14 });
          x += colWidths.name + 1;
          doc.text(item.phone || 'N/A', x, startY + 6, { width: colWidths.phone, height: 14 });
          x += colWidths.phone + 1;
          doc.text(item.email || 'N/A', x, startY + 6, { width: colWidths.email, height: 14 });
          x += colWidths.email + 1;

          // Colour the form source cell
          const srcBg = sourceBg[item.formSource] ?? '#FFFFFF';
          doc.fillColor(srcBg).rect(x - 2, startY + 2, colWidths.source + 2, 18).fill();
          doc.fillColor('#0B1536').text(item.formSource || 'N/A', x, startY + 6, { width: colWidths.source, height: 14 });
          x += colWidths.source + 1;

          doc.fillColor('#333333');
          doc.text(item.branch || 'N/A', x, startY + 6, { width: colWidths.branch, height: 14 });
          x += colWidths.branch + 1;
          doc.text(dateStr, x, startY + 6, { width: colWidths.date, height: 14 });

          startY += 22;
        });
      });

      const filenameLabel = source ? `_${source.replace(/\s+/g, '_')}` : '';
      ctx.type = 'application/pdf';
      ctx.set('Content-Disposition', `attachment; filename="All_Leads${filenameLabel}_Export_${Date.now()}.pdf"`);
      ctx.body = pdfBuffer;
    },
  })
);
