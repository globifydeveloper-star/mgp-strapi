import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { createCrmService } from '../../enquiry/services/crm';

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

      const documents = strapi.documents('api::blog-enquiry.blog-enquiry');

      let entry = await documents.create({
        data: {
          name,
          mobile,
          email,
          blogTitle,
          source: 'BLOG',
          submittedAt: new Date().toISOString(),
          crmPushStatus: 'Pending',
        },
      });

      const crmConfig = strapi.config.get('crm') as {
        baseUrl: string;
        timeout: number;
      };

      // Mirror to All Leads (fire-and-forget)
      const allLeadService = strapi.service('api::all-lead.all-lead') as any;
      if (allLeadService?.mirrorLead) {
        allLeadService
          .mirrorLead({
            name,
            phone: mobile,
            email,
            formSource: 'Blog Enquiry',
            sourceFormDetail: blogTitle,
            branchCode,
            submittedAt: new Date().toISOString(),
            crmPushStatus: 'Pending',
          })
          .catch((e: unknown) => strapi.log.error('[blog-enquiry] All Leads mirror error:', e));
      }

      // Background CRM Push Enabled
      (async () => {
        try {
          const crm = createCrmService(crmConfig);
          const result = await crm.syncEnquiry({ name, mobile, email, leadSource: 'BLOG', branchCode: branchCode ?? "" });

          const updated = await documents.update({
            documentId: entry.documentId,
            data: {
              crmPushStatus: 'Sent',
              crmLeadId: result.leadId,
              crmResponse: JSON.parse(JSON.stringify(result.response)),
            },
          });
          if (updated) entry = updated;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown CRM error.';
          strapi.log.error(`[blog-enquiry] CRM push failed for entry ${entry.documentId}: ${message}`);

          const updated = await documents.update({
            documentId: entry.documentId,
            data: {
              crmPushStatus: 'Failed',
              crmError: message,
            },
          });
          if (updated) entry = updated;
        }
      })().catch(e => strapi.log.error('CRM async error:', e));

      return entry;
    },
  })
);
