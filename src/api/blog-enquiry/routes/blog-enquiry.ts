export default {
  routes: [
    {
      method: 'POST',
      path: '/blog-enquiries',
      handler: 'blog-enquiry.create',
      config: {
      },
    },
    {
      method: 'GET',
      path: '/blog-enquiries',
      handler: 'blog-enquiry.find',
      config: {
        auth: false,
      },
    },
  ],
};
