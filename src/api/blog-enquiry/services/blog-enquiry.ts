import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { buildRemarks } from '../../enquiry/utils/remarks';
import type { EnquiryForCrm } from '../../enquiry/utils/crmMapper';

const { ValidationError } = errors;

export interface BlogEnquiryInput {
  name: string;
  mobile: string;
  email?: string;
  blogTitle?: string;
  branchCode?: string;
}

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} is required.`);
  }
  return value.trim();
};

export default factories.createCoreService(
  'api::blog-enquiry.blog-enquiry',
  ({ strapi }) => ({
    async submitAndSync(payload: unknown) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationError('A valid blog enquiry payload is required.');
      }

      const input = payload as Record<string, unknown>;
      const name = requiredString(input.name, 'name');
      const mobile = requiredString(input.mobile ?? input.phone, 'mobile');
      const email = typeof input.email === 'string' && input.email.trim() ? input.email.trim() : undefined;
      const blogTitle = typeof input.blogTitle === 'string' && input.blogTitle.trim() ? input.blogTitle.trim() : (input.sourceForm as string ?? undefined);
      const branchCode = typeof input.branchCode === 'string' && input.branchCode.trim() ? input.branchCode.trim() : undefined;

      const formattedRemarks = buildRemarks({
        formType: 'blog',
        sourceForm: blogTitle ? `Blog: ${blogTitle}` : 'Blog',
        enquiryType: 'Blog Enquiry',
        branchCode,
      });

      const crmRequest: EnquiryForCrm = {
        name,
        mobile,
        email,
        leadSource: 'BLOG',
        branchCode: branchCode ?? '',
        remarks: formattedRemarks,
      };

      const documents = strapi.documents('api::blog-enquiry.blog-enquiry');

      const entry = await documents.create({
        data: {
          name,
          mobile,
          email,
          blogTitle,
          source: 'BLOG',
          submittedAt: new Date().toISOString(),
          crmPushStatus: 'Pending',
          crmRequest,
        },
      });

      if (!branchCode) {
        strapi.log.warn(`[crm] missing branchCode for api::blog-enquiry.blog-enquiry / ${entry.documentId}`);
      }

      // Background mirror and CRM push
      (async () => {
        try {
          const allLeadService = strapi.service('api::all-lead.all-lead') as any;
          let mirrorDocId: string | null = null;
          if (allLeadService?.mirrorLead) {
            mirrorDocId = await allLeadService.mirrorLead({
              name,
              phone: mobile,
              email,
              formSource: 'Blog Enquiry',
              sourceFormDetail: blogTitle,
              branchCode,
              submittedAt: new Date().toISOString(),
              crmPushStatus: 'Pending',
            });
          }

          if (mirrorDocId) {
            await documents.update({
              documentId: entry.documentId,
              data: { allLeadDocumentId: mirrorDocId },
            });
          }

          const crmSync = strapi.service('api::all-lead.crm-sync') as any;
          if (crmSync?.pushOne) {
            await crmSync.pushOne('api::blog-enquiry.blog-enquiry', entry.documentId);
          }
        } catch (bgErr) {
          strapi.log.error(`[blog-enquiry] Background sync error for ${entry.documentId}:`, bgErr);
        }
      })().catch((e) => strapi.log.error('[blog-enquiry] Unhandled background error:', e));

      return entry;
    },
  })
);
