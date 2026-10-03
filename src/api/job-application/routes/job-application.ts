export default {
  routes: [
    {
      method: 'POST',
      path: '/job-applications',
      handler: 'job-application.create',
      config: {
      },
    },
    {
      method: 'GET',
      path: '/job-applications/export/pdf',
      handler: 'job-application.exportBulkPdf',
      config: {
        },
    },
    {
      method: 'GET',
      path: '/job-applications/export/csv',
      handler: 'job-application.exportBulkCsv',
      
    },
    {
      method: 'GET',
      path: '/job-applications/export/zip',
      handler: 'job-application.exportBulkZip',
      
    },
    {
      method: 'GET',
      path: '/job-applications/:id/resume',
      handler: 'job-application.downloadResume',
      
    },
    {
      method: 'GET',
      path: '/job-applications/:id/pdf',
      handler: 'job-application.generateSinglePdf',
      
    },
  ],
};


