import type { Core } from '@strapi/strapi';

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  throw new Error('CORS_ORIGINS environment variable is missing in production');
}
const origins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : [];

// Upload bucket host for admin media previews; follows the upload provider's bucket per environment.
const uploadBucketHost =
  process.env.AWS_BUCKET && process.env.AWS_REGION
    ? `${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`
    : 'mgpwebsiteuat.s3.ap-south-1.amazonaws.com';

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
            uploadBucketHost,
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            uploadBucketHost,
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
