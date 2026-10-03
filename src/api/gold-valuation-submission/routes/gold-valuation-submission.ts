export default {
  routes: [
    {
      method: 'POST',
      path: '/gold-valuation-submissions',
      handler: 'gold-valuation-submission.create',
      config: {
      },
    },
    {
      method: 'GET',
      path: '/gold-valuation-submissions',
      handler: 'gold-valuation-submission.find',
    },
  ],
};


