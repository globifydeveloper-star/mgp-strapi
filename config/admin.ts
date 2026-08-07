import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Admin => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET')!,
  },
  apiToken: {
    salt: env('API_TOKEN_SALT')!,
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT')!,
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY')!,
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
    docLinks: env.bool('FLAG_DOC_LINKS', true),
  },
  preview: {
    enabled: true,
    config: {
      async handler(uid, { documentId }) {
        const clientUrl = env('CLIENT_URL', 'http://localhost:3000');

        switch (uid) {
          case 'api::blog-post.blog-post': {
            if (!documentId) return `${clientUrl}/blog`;
            const doc = await strapi.documents('api::blog-post.blog-post').findOne({
              documentId,
            });
            return `${clientUrl}/blog/${doc?.slug ?? ''}`;
          }
          case 'api::homepage.homepage': {
            return `${clientUrl}`;
          }
          case 'api::blog-page-setting.blog-page-setting': {
            return `${clientUrl}/blog`;
          }
          case 'api::career-page-setting.career-page-setting': {
            return `${clientUrl}/career`;
          }
          case 'api::job-position.job-position': {
            return `${clientUrl}/career`;
          }
          default: {
            return `${clientUrl}`;
          }
        }
      },
    },
  },
});

export default config;
