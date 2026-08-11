import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { createCrmService } from '../../enquiry/services/crm';

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
      const city = typeof input.city === 'string' && input.city.trim() ? input.city.trim() : (input.branch as string ?? undefined);
      const state = typeof input.state === 'string' && input.state.trim() ? input.state.trim() : undefined;
      const address = typeof input.address === 'string' && input.address.trim() ? input.address.trim() : undefined;
      const preferredDate = typeof input.preferredDate === 'string' ? input.preferredDate.trim() : undefined;
      const details = typeof input.details === 'object' && input.details !== null ? (input.details as Record<string, unknown>) : undefined;

      const documents = strapi.documents('api::mobile-van-submission.mobile-van-submission');

      let entry = await documents.create({
        data: {
          name,
          phone,
          email,
          city,
          state,
          address,
          preferredDate,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
          submittedAt: new Date().toISOString(),
          crmPushStatus: 'Pending',
        },
      });

      const crmConfig = strapi.config.get('crm') as {
        baseUrl: string;
        token: string;
        timeout: number;
      };

      try {
        const crm = createCrmService(crmConfig);
        const result = await crm.syncEnquiry({ name, mobile: phone, email, leadSource: 'HOME_PAGE' });

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
        strapi.log.error(`[mobile-van-submission] CRM push failed for entry ${entry.documentId}: ${message}`);

        const updated = await documents.update({
          documentId: entry.documentId,
          data: {
            crmPushStatus: 'Failed',
            crmError: message,
          },
        });
        if (updated) entry = updated;
      }

      return entry;
    },
  })
);
