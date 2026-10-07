export default {
  crmRetry: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const crmSync = strapi.service('api::all-lead.crm-sync') as any;
        if (crmSync?.processPending) {
          await crmSync.processPending();
        }
      } catch (err) {
        strapi.log.error('[cron-crm-retry] Error executing CRM retry job:', err);
      }
    },
    options: {
      rule: '*/10 * * * *',
      tz: 'Asia/Kolkata',
    },
  },
};
