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
  ],
};
