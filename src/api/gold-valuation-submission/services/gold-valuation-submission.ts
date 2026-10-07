import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { createCrmService } from '../../enquiry/services/crm';
import { buildRemarks } from '../../enquiry/utils/remarks';
import type { FormSource } from '../../all-lead/services/all-lead';

const { ValidationError } = errors;

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} is required.`);
  }
  return value.trim();
};

const MAX_WEIGHT_GRAMS = 1000;

const validateWeight = (value: string, field: string): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_WEIGHT_GRAMS) {
    throw new ValidationError(`${field} must be a positive number up to ${MAX_WEIGHT_GRAMS} grams.`);
  }
  return value;
};

export default factories.createCoreService(
  'api::gold-valuation-submission.gold-valuation-submission',
  ({ strapi }) => ({
    async submitAndSync(payload: unknown) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new ValidationError('A valid gold valuation submission payload is required.');
      }

      const input = payload as Record<string, unknown>;
      const name = requiredString(input.name, 'name');
      const phone = requiredString(input.phone ?? input.mobile, 'phone');
      const email = typeof input.email === 'string' && input.email.trim() ? input.email.trim() : undefined;
      const branch = typeof input.branch === 'string' && input.branch.trim() ? input.branch.trim() : undefined;
      const branchName = typeof input.branchName === 'string' && input.branchName.trim() ? input.branchName.trim() : undefined;
      const branchCode = typeof input.branchCode === 'string' && input.branchCode.trim() ? input.branchCode.trim() : undefined;
      const branchValidated = typeof input.branchValidated === 'boolean' ? input.branchValidated : undefined;
      const formType = typeof input.formType === 'string' && input.formType.trim() ? input.formType.trim() : undefined;
      const purity = typeof input.purity === 'string' && input.purity.trim() ? input.purity.trim() : undefined;
      const weight = input.weight !== undefined && input.weight !== null
        ? validateWeight(String(input.weight).trim(), 'weight')
        : undefined;
      const sourceForm = typeof input.sourceForm === 'string' && input.sourceForm.trim() ? input.sourceForm.trim() : 'Gold Valuation Form';
      const details = typeof input.details === 'object' && input.details !== null ? (input.details as Record<string, unknown>) : undefined;

      if (details && details.weight !== undefined && details.weight !== null) {
        validateWeight(String(details.weight).trim(), 'details.weight');
      }

      const documents = strapi.documents('api::gold-valuation-submission.gold-valuation-submission');

      let entry = await documents.create({
        data: {
          name,
          phone,
          email,
          branch: branchName || branch,
          purity,
          weight,
          sourceForm,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
          submittedAt: new Date().toISOString(),
          crmPushStatus: 'Pending',
        },
      });

      const crmConfig = strapi.config.get('crm') as {
        baseUrl: string;
        timeout: number;
      };

      // Determine All Leads Form Source label from formType
      let allLeadFormSource: FormSource = 'Gold Rate Check';
      if (formType === 'sell-gold-modal') {
        allLeadFormSource = 'Sell Gold Modal';
      } else if (formType === 'gold-value') {
        allLeadFormSource = 'Gold Value Form';
      }

      // Mirror to All Leads (fire-and-forget)
      const allLeadService = strapi.service('api::all-lead.all-lead') as any;
      if (allLeadService?.mirrorLead) {
        allLeadService
          .mirrorLead({
            name,
            phone,
            email,
            formSource: allLeadFormSource,
            sourceFormDetail: sourceForm,
            branch: branchName || branch,
            branchCode,
            extraData: { purity, weight, ...(details ?? {}) },
            submittedAt: new Date().toISOString(),
            crmPushStatus: 'Pending',
          })
          .catch((e: unknown) => strapi.log.error('[gold-valuation-submission] All Leads mirror error:', e));
      }

      if (!branchCode) {
        strapi.log.warn(`[crm] missing branchCode for api::gold-valuation-submission.gold-valuation-submission / ${entry.documentId}`);
      }

      const formattedRemarks = buildRemarks({
        formType: formType || 'gold-value',
        sourceForm,
        purity,
        weight,
        branch: branchName || branch,
        branchName,
        branchCode,
        branchValidated,
        message: details?.message ? String(details.message) : undefined,
      });

      (async () => {
        try {
          const crm = createCrmService(crmConfig);
          const result = await crm.syncEnquiry({
            name,
            mobile: phone,
            email,
            leadSource: 'HOME_PAGE',
            branchCode: branchCode ?? '',
            remarks: formattedRemarks,
          });

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
          strapi.log.error(`[gold-valuation-submission] CRM push failed for entry ${entry.documentId}: ${message}`);

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
