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
      const message = typeof input.message === 'string' ? input.message.trim() : (typeof input.details === 'string' ? input.details.trim() : undefined);

      const documents = strapi.documents('api::contact-submission.contact-submission');

      let entry = await documents.create({
        data: {
          name,
          phone,
          email,
          branch,
          message,
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
        const result = await crm.syncEnquiry({ name, mobile: phone, email, leadSource: 'CONTACT_US' });

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
        strapi.log.error(`[contact-submission] CRM push failed for entry ${entry.documentId}: ${message}`);

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
