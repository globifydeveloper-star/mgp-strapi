import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { createCrmService } from '../../enquiry/services/crm';

const { ValidationError } = errors;

export type EnquiryType =
  | 'Contact Us'
  | 'Mobile Van'
  | 'Enquire Now'
  | 'Offers Popup'
  | 'Blog Enquiry'
  | 'Other';

export interface FormSubmissionInput {
  name: string;
  phone: string;
  email?: string;
  branch?: string;
  enquiryType?: EnquiryType;
  sourceForm?: string;
  purity?: string;
  weight?: string;
  details?: Record<string, unknown>;
}

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} is required.`);
  }
  return value.trim();
};

export default factories.createCoreService(
  'api::form-submission.form-submission',
  ({ strapi }) => ({
    async submitAndSync(payload: unknown) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationError('A valid submission payload is required.');
      }

      const input = payload as Record<string, unknown>;
      const name = requiredString(input.name, 'name');
      const phone = requiredString(input.phone ?? input.mobile, 'phone');
      const email = typeof input.email === 'string' && input.email.trim() ? input.email.trim() : undefined;
      const branch = typeof input.branch === 'string' && input.branch.trim() ? input.branch.trim() : undefined;
      const sourceForm = typeof input.sourceForm === 'string' && input.sourceForm.trim() ? input.sourceForm.trim() : (input.source as string ?? 'Form');
      const purity = typeof input.purity === 'string' && input.purity.trim() ? input.purity.trim() : undefined;
      const weight = input.weight !== undefined && input.weight !== null ? String(input.weight).trim() : undefined;
      const details = typeof input.details === 'object' && input.details !== null ? (input.details as Record<string, unknown>) : undefined;
      
      const enquiryType = (typeof input.enquiryType === 'string' ? input.enquiryType : 'Enquire Now') as EnquiryType;

      const documents = strapi.documents('api::form-submission.form-submission');

      // 1. Dual-Write Step A: Persist to Strapi IMMEDIATELY with Pending status
      let submission = await documents.create({
        data: {
          name,
          phone,
          email,
          branch,
          enquiryType,
          sourceForm,
          purity,
          weight,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
          submittedAt: new Date().toISOString(),
          crmPushStatus: 'Pending',
        },
      });

      // 2. Dual-Write Step B: Push to CRM asynchronously
      const crmConfig = strapi.config.get('crm') as {
        baseUrl: string;
        token: string;
        timeout: number;
      };

      // Background CRM Push
      (async () => {
        try {
          const crm = createCrmService(crmConfig);
        const result = await crm.syncEnquiry({ name, mobile: phone, email });

        const updated = await documents.update({
          documentId: submission.documentId,
          data: {
            crmPushStatus: 'Sent',
            crmLeadId: result.leadId,
            crmResponse: JSON.parse(JSON.stringify(result.response)),
          },
        });
        if (updated) submission = updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown CRM error.';
        strapi.log.error(`[form-submission] CRM push failed for submission ${submission.documentId}: ${message}`);

        const updated = await documents.update({
          documentId: submission.documentId,
          data: {
            crmPushStatus: 'Failed',
            crmError: message,
          },
        });
        if (updated) submission = updated;
        }
      })().catch(e => strapi.log.error('CRM async error:', e));

      // 3. Automatically route
      (async () => {
        try {
        const isBlog = enquiryType === 'Blog Enquiry' || (sourceForm && sourceForm.toLowerCase().includes('blog'));
        const isContact = enquiryType === 'Contact Us' || (sourceForm && sourceForm.toLowerCase().includes('contact'));
        const isVan = enquiryType === 'Mobile Van' || (sourceForm && sourceForm.toLowerCase().includes('van'));

        if (isBlog) {
          const blogService = strapi.service('api::blog-enquiry.blog-enquiry') as any;
          if (blogService) await blogService.submitAndSync({ name, mobile: phone, email, blogTitle: sourceForm });
        } else if (isContact) {
          const contactService = strapi.service('api::contact-submission.contact-submission') as any;
          if (contactService) await contactService.submitAndSync({ name, phone, email, branch, message: details ? JSON.stringify(details) : sourceForm });
        } else if (isVan) {
          const vanService = strapi.service('api::mobile-van-submission.mobile-van-submission') as any;
          if (vanService) await vanService.submitAndSync({ name, phone, email, city: branch, details });
        } else {
          const goldService = strapi.service('api::gold-valuation-submission.gold-valuation-submission') as any;
          if (goldService) await goldService.submitAndSync({ name, phone, email, branch, purity, weight, sourceForm, details });
        }
      } catch (dispErr) {
        strapi.log.warn('[form-submission] Dedicated collection dispatch notice:', dispErr);
      }
      })().catch(e => strapi.log.error('Routing async error:', e));

      return submission;
    },

    /**
     * Retry asynchronous CRM push for submissions that previously failed or are pending.
     * Can retry a specific submission by documentId or all failed submissions.
     */
    async retryFailedSubmissions(targetDocumentId?: string) {
      const documents = strapi.documents('api::form-submission.form-submission');
      
      const statusFilter: ('Failed' | 'Pending')[] = ['Failed', 'Pending'];
      const filters = targetDocumentId
        ? ({ documentId: { $eq: targetDocumentId } } as const)
        : ({ crmPushStatus: { $in: statusFilter } } as const);

      const failedRecords = await documents.findMany({ filters });
      strapi.log.info(`[form-submission] Found ${failedRecords.length} records to retry CRM push.`);

      const crmConfig = strapi.config.get('crm') as {
        baseUrl: string;
        token: string;
        timeout: number;
      };
      const crm = createCrmService(crmConfig);
      const results = [];

      for (const record of failedRecords) {
        try {
          const result = await crm.syncEnquiry({
            name: record.name as string,
            mobile: record.phone as string,
            email: record.email as string | undefined,
          });

          const updated = await documents.update({
            documentId: record.documentId,
            data: {
              crmPushStatus: 'Sent',
              crmLeadId: result.leadId,
              crmResponse: JSON.parse(JSON.stringify(result.response)),
              crmError: undefined,
            },
          });
          results.push(updated ?? record);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown CRM error during retry.';
          strapi.log.error(`[form-submission] Retry failed for submission ${record.documentId}: ${message}`);
          
          const updated = await documents.update({
            documentId: record.documentId,
            data: {
              crmPushStatus: 'Failed',
              crmError: message,
            },
          });
          results.push(updated ?? record);
        }
      }

      return results;
    },
  })
);
