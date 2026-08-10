export default {
  routes: [
    {
      method: 'POST',
      path: '/gold-valuation-submissions',
      handler: 'gold-valuation-submission.create',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/gold-valuation-submissions',
      handler: 'gold-valuation-submission.find',
      config: {
        auth: false,
      },
    },
  ],
};
