export default {
  routes: [
    {
      method: 'POST',
      path: '/job-applications',
      handler: 'job-application.create',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/job-applications/export/pdf',
      handler: 'job-application.exportBulkPdf',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/job-applications/export/csv',
      handler: 'job-application.exportBulkCsv',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/job-applications/:id/resume',
      handler: 'job-application.downloadResume',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/job-applications/:id/pdf',
      handler: 'job-application.generateSinglePdf',
      config: {
        auth: false,
      },
    },
  ],
};
