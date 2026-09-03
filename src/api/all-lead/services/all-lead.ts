import { factories } from '@strapi/strapi';

export type FormSource =
  | 'Contact Submission'
  | 'Gold Rate Check'
  | 'Mobile Van'
  | 'Blog Enquiry'
  | 'Enquiry';

export interface AllLeadMirrorPayload {
  name: string;
  phone: string;
  email?: string;
  formSource: FormSource;
  sourceFormDetail?: string;
  branch?: string;
  branchCode?: string;
  extraData?: Record<string, unknown>;
  submittedAt?: string;
  crmPushStatus?: 'Sent' | 'Pending' | 'Failed';
  crmLeadId?: string;
  crmResponse?: Record<string, unknown>;
  crmError?: string;
}

export default factories.createCoreService(
  'api::all-lead.all-lead',
  ({ strapi }) => ({
    /**
     * Mirror a lead from any form into the All Leads collection.
     * Called asynchronously by each specialised service after creating its own record.
     */
    async mirrorLead(payload: AllLeadMirrorPayload): Promise<void> {
      try {
        const documents = strapi.documents('api::all-lead.all-lead');
        await documents.create({
          data: {
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            formSource: payload.formSource,
            sourceFormDetail: payload.sourceFormDetail,
            branch: payload.branch,
            branchCode: payload.branchCode,
            extraData: payload.extraData
              ? JSON.parse(JSON.stringify(payload.extraData))
              : undefined,
            submittedAt: payload.submittedAt ?? new Date().toISOString(),
            crmPushStatus: payload.crmPushStatus ?? 'Pending',
            crmLeadId: payload.crmLeadId,
            crmResponse: payload.crmResponse
              ? JSON.parse(JSON.stringify(payload.crmResponse))
              : undefined,
            crmError: payload.crmError,
          },
        });
      } catch (err) {
        strapi.log.error(
          `[all-lead] Failed to mirror lead from "${payload.formSource}": ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    },
  })
);
