export default {
  routes: [
    {
      method: 'GET',
      path: '/all-leads',
      handler: 'all-lead.find',
      
    },
    {
      method: 'GET',
      path: '/all-leads/export/csv',
      handler: 'all-lead.exportBulkCsv',
      
    },
    {
      method: 'GET',
      path: '/all-leads/export/pdf',
      handler: 'all-lead.exportBulkPdf',
      
    },
    {
      method: 'POST',
      path: '/all-leads',
      handler: 'all-lead.create',
      config: {
      },
    },
  ],
};


