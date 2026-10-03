export default {
  routes: [
    {
      method: 'GET',
      path: '/contact-submissions/export/pdf',
      handler: 'contact-submission.exportBulkPdf',
      
    },
    {
      method: 'GET',
      path: '/contact-submissions/export/csv',
      handler: 'contact-submission.exportBulkCsv',
      
    },
    {
      method: 'GET',
      path: '/contact-submissions/:id/pdf',
      handler: 'contact-submission.generateSinglePdf',
      
    },
    {
      method: 'GET',
      path: '/contact-submissions',
      handler: 'contact-submission.find',
    },
  ],
};


