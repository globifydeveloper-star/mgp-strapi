export default {
  routes: [
    {
      method: 'GET',
      path: '/all-leads',
      handler: 'all-lead.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/all-leads/export/csv',
      handler: 'all-lead.exportBulkCsv',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/all-leads/export/pdf',
      handler: 'all-lead.exportBulkPdf',
      config: {
        auth: false,
      },
    },
  ],
};
