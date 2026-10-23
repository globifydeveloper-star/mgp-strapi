import fs from 'fs';
import path from 'path';
import { Core } from '@strapi/strapi';

/**
 * Seeds the content single types from the website's built-in content.
 *
 * The JSON files in ./content are copied from MGP-WEB/src/content by
 * `node scripts/sync-cms-seeds.mjs` (run in MGP-WEB), so the CMS starts with
 * exactly what the site shows when a field is empty. Seeding only runs for an
 * entry that does not exist yet, so editors' changes are never overwritten.
 */
const CONTENT_DIR = path.join(__dirname, 'content');

function readSeed(name: string): Record<string, any> | null {
  // Compiled builds run from dist/src/seed; the JSON stays in src/seed/content.
  const candidates = [
    path.join(CONTENT_DIR, `${name}.json`),
    path.join(process.cwd(), 'src', 'seed', 'content', `${name}.json`),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return null;
}

// Keeps only fields the content type defines, so extra keys in the JSON (e.g. a list of FAQs) don't fail the create.
function pickAttributes(strapi: Core.Strapi, uid: string, data: Record<string, any>) {
  const attributes = (strapi.contentType(uid as any) as any)?.attributes ?? {};
  return Object.fromEntries(Object.entries(data).filter(([key]) => key in attributes));
}

export const CONTENT_PAGE_SEEDS: { uid: string; file: string }[] = [
  { uid: 'api::community-page.community-page', file: 'community-page' },
  { uid: 'api::faq-page.faq-page', file: 'faq-page' },
  { uid: 'api::privacy-policy-page.privacy-policy-page', file: 'privacy-policy-page' },
  { uid: 'api::testimonials-page.testimonials-page', file: 'testimonials-page' },
];

export async function seedContentPages(strapi: Core.Strapi) {
  for (const { uid, file } of CONTENT_PAGE_SEEDS) {
    try {
      if (!strapi.contentType(uid as any)) continue;
      const existing = await strapi.documents(uid as any).findFirst();
      if (existing) continue;
      const seed = readSeed(file);
      if (!seed) {
        strapi.log.warn(`No seed content found for ${uid} (${file}.json)`);
        continue;
      }
      strapi.log.info(`Seeding ${uid}...`);
      await strapi.documents(uid as any).create({ data: pickAttributes(strapi, uid, seed) as any });
    } catch (err) {
      strapi.log.warn(`Skipped ${uid} seed: ${(err as Error).message}`);
    }
  }

  // FAQ page questions live in the FAQ collection under section "faq".
  try {
    const faqUid = 'api::faq.faq';
    const existing = await strapi.documents(faqUid).findMany({ filters: { section: 'faq' } as any, limit: 1 });
    const seed = readSeed('faq-page');
    if (existing.length === 0 && Array.isArray(seed?.faqs)) {
      strapi.log.info('Seeding FAQ page questions...');
      for (const faq of seed.faqs) {
        await strapi.documents(faqUid).create({ data: { ...faq, section: 'faq' } });
      }
    }
  } catch (err) {
    strapi.log.warn(`Skipped FAQ page questions seed: ${(err as Error).message}`);
  }
}
