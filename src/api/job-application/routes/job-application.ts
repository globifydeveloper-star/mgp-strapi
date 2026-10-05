export default {
  routes: [
    {
      method: 'POST',
      path: '/job-applications',
      handler: 'job-application.create',
      config: {},
    },
    // Admin-only routes: Strapi's content-API login is skipped because it rejects
    // admin-panel tokens. The controller's verifyAdminSession() is the gate and
    // accepts only an active admin-panel session.
    {
      method: 'GET',
      path: '/job-applications/export/pdf',
      handler: 'job-application.exportBulkPdf',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/job-applications/export/csv',
      handler: 'job-application.exportBulkCsv',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/job-applications/export/zip',
      handler: 'job-application.exportBulkZip',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/job-applications/:id/resume',
      handler: 'job-application.downloadResume',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/job-applications/:id/pdf',
      handler: 'job-application.generateSinglePdf',
      config: { auth: false },
    },
  ],
};