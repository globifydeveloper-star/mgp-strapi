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
  'api::mobile-van-submission.mobile-van-submission',
  ({ strapi }) => ({
    async submitAndSync(payload: unknown) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationError('A valid mobile van submission payload is required.');
      }

      const input = payload as Record<string, unknown>;
      const name = requiredString(input.name, 'name');
      const phone = requiredString(input.phone ?? input.mobile, 'phone');
      const email = typeof input.email === 'string' && input.email.trim() ? input.email.trim() : undefined;
      const city = typeof input.city === 'string' && input.city.trim() ? input.city.trim() : undefined;
      const state = typeof input.state === 'string' && input.state.trim() ? input.state.trim() : undefined;
      const branchName = typeof input.branchName === 'string' && input.branchName.trim()
        ? input.branchName.trim()
        : (typeof input.branch === 'string' && input.branch.trim() ? input.branch.trim() : undefined);
      const branchCode = typeof input.branchCode === 'string' && input.branchCode.trim() ? input.branchCode.trim() : undefined;
      const branchValidated = typeof input.branchValidated === 'boolean' ? input.branchValidated : undefined;
      const address = typeof input.address === 'string' && input.address.trim() ? input.address.trim() : undefined;
      const preferredDate = typeof input.preferredDate === 'string' ? input.preferredDate.trim() : undefined;
      const details = typeof input.details === 'object' && input.details !== null ? (input.details as Record<string, unknown>) : undefined;

      const formattedRemarks = buildRemarks({
        formType: 'mobile-van',
        sourceForm: 'Mobile Van Appointment',
        enquiryType: 'Mobile Van',
        city,
        state,
        branch: branchName || city,
        branchName,
        branchCode,
        branchValidated,
        message: address ? `Address: ${address}${preferredDate ? `, Date: ${preferredDate}` : ''}` : (preferredDate ? `Date: ${preferredDate}` : undefined),
      });

      const crmRequest: EnquiryForCrm = {
        name,
        mobile: phone,
        email,
        leadSource: 'HOME_PAGE',
        branchCode: branchCode ?? '',
        remarks: formattedRemarks,
      };

      const documents = strapi.documents('api::mobile-van-submission.mobile-van-submission');

      const entry = await documents.create({
        data: {
          name,
          phone,
          email,
          city: city || branchName,
          state,
          address,
          preferredDate,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
          submittedAt: new Date().toISOString(),
          crmPushStatus: 'Pending',
          crmRequest,
        },
      });

      if (!branchCode) {
        strapi.log.warn(`[crm] missing branchCode for api::mobile-van-submission.mobile-van-submission / ${entry.documentId}`);
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
              formSource: 'Mobile Van',
              branch: branchName || city,
              branchCode,
              extraData: { city, state, branchName, address, preferredDate, ...(details ?? {}) },
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
            await crmSync.pushOne('api::mobile-van-submission.mobile-van-submission', entry.documentId);
          }
        } catch (bgErr) {
          strapi.log.error(`[mobile-van-submission] Background sync error for ${entry.documentId}:`, bgErr);
        }
      })().catch((e) => strapi.log.error('[mobile-van-submission] Unhandled background error:', e));

      return entry;
    },
  })
);
