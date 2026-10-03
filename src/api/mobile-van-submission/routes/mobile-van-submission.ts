export default {
  routes: [
    {
      method: 'POST',
      path: '/mobile-van-submissions',
      handler: 'mobile-van-submission.create',
      config: {
      },
    },
    {
      method: 'GET',
      path: '/mobile-van-submissions',
      handler: 'mobile-van-submission.find',
      config: {
        auth: false,
      },
    },
  ],
};
