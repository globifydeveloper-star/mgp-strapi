import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { buildRemarks } from '../../enquiry/utils/remarks';
import type { EnquiryForCrm } from '../../enquiry/utils/crmMapper';

const { ValidationError } = errors;

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} is required.`);
  }
  return value.trim();
};

export default factories.createCoreService(
  'api::contact-submission.contact-submission',
  ({ strapi }) => ({
    async submitAndSync(payload: unknown) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationError('A valid contact submission payload is required.');
      }

      const input = payload as Record<string, unknown>;
      const name = requiredString(input.name, 'name');
      const phone = requiredString(input.phone ?? input.mobile, 'phone');
      const email = typeof input.email === 'string' && input.email.trim() ? input.email.trim() : undefined;
      const branch = typeof input.branch === 'string' && input.branch.trim() ? input.branch.trim() : undefined;
      const branchCode = typeof input.branchCode === 'string' && input.branchCode.trim() ? input.branchCode.trim() : undefined;
      const enquiryType = typeof input.enquiryType === 'string' && input.enquiryType.trim() ? input.enquiryType.trim() : undefined;
      const message = typeof input.message === 'string' ? input.message.trim() : (typeof input.details === 'string' ? input.details.trim() : undefined);

      const documents = strapi.documents('api::contact-submission.contact-submission');

      const formattedRemarks = buildRemarks({
        formType: 'contact',
        sourceForm: 'Contact Us Page',
        enquiryType: enquiryType || 'Contact Us',
        branch,
        branchCode,
        message,
      });

      const crmRequest: EnquiryForCrm = {
        name,
        mobile: phone,
        email,
        leadSource: 'CONTACT_US',
        branchCode: branchCode ?? '',
        remarks: formattedRemarks,
      };

      const entry = await documents.create({
        data: {
          name,
          phone,
          email,
          branch,
          message,
          submittedAt: new Date().toISOString(),
          crmPushStatus: 'Pending',
          crmRequest,
        },
      });

      if (!branchCode) {
        strapi.log.warn(`[crm] missing branchCode for api::contact-submission.contact-submission / ${entry.documentId}`);
      }

      // Background mirror and CRM push
      (async () => {
        try {
          const allLeadService = strapi.service('api::all-lead.all-lead') as any;
          let mirrorDocId: string | null = null;
          if (allLeadService?.mirrorLead) {
            mirrorDocId = await allLeadService.mirrorLead({
              name,
              phone,
              email,
              formSource: 'Contact Submission',
              sourceFormDetail: message,
              branch,
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
            await crmSync.pushOne('api::contact-submission.contact-submission', entry.documentId);
          }
        } catch (bgErr) {
          strapi.log.error(`[contact-submission] Background sync error for ${entry.documentId}:`, bgErr);
        }
      })().catch((e) => strapi.log.error('[contact-submission] Unhandled background error:', e));

      return entry;
    },
  })
);
