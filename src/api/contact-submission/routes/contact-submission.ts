export default {
  routes: [
    {
      method: 'POST',
      path: '/contact-submissions',
      handler: 'contact-submission.create',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/contact-submissions/export/pdf',
      handler: 'contact-submission.exportBulkPdf',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/contact-submissions/:id/pdf',
      handler: 'contact-submission.generateSinglePdf',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/contact-submissions',
      handler: 'contact-submission.find',
      config: {
        auth: false,
      },
    },
  ],
};
