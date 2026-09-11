import type { Core } from '@strapi/strapi';

export default ({ env }: Core.Config.Shared.ConfigParams) => ({
  baseUrl: env('CRM_BASE_URL', ''),
  timeout: env.int('CRM_TIMEOUT', 10000),
});
