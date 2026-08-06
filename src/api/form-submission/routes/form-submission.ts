export default {
  routes: [
    {
      method: 'POST',
      path: '/form-submissions',
      handler: 'form-submission.create',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/form-submissions',
      handler: 'form-submission.find',
      config: {
        auth: false,
      },
    },
  ],
};
