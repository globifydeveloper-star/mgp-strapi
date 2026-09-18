import type { Core } from '@strapi/strapi';

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
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://mgp-web.vercel.app',
            'https://mgp-web-q2au.vercel.app',
            'https://*.vercel.app',
            'https://mgpwebsiteui-uat.muthootgoldpoint.com',
          ],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            'pub-bd272ef986bf4b208d871d215567b407.r2.dev',
            'mgpwebsiteuat.s3.ap-south-1.amazonaws.com',
            'mgpwebsiteuat.s3.amazonaws.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            'pub-bd272ef986bf4b208d871d215567b407.r2.dev',
            'mgpwebsiteuat.s3.ap-south-1.amazonaws.com',
            'mgpwebsiteuat.s3.amazonaws.com',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['*'],
      headers: ['*'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;