import type { Core } from '@strapi/strapi';

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  throw new Error('CORS_ORIGINS environment variable is missing in production');
}
const origins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : [];

// Upload bucket host for admin media previews; follows the upload provider's bucket per environment.
// Known hosts are listed explicitly so previews work even if AWS_BUCKET/AWS_REGION are unset at runtime.
const mediaHosts = Array.from(
  new Set(
    [
      'mgpwebsiteuat.s3.ap-south-1.amazonaws.com',
      'mgpwebsiteprod.s3.ap-south-1.amazonaws.com',
      'pub-bd272ef986bf4b208d871d215567b407.r2.dev',
      process.env.AWS_BUCKET && process.env.AWS_REGION
        ? `${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`
        : null,
    ].filter((h): h is string => Boolean(h)),
  ),
);

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'frame-src': [
            "'self'",
            ...origins,
          ],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            ...mediaHosts,
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            ...mediaHosts,
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: origins,
      headers: ['*', 'x-internal-secret'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    },
  },
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
