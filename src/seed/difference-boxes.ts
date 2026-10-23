import fs from 'fs';
import path from 'path';
import { Core } from '@strapi/strapi';

/**
 * Seeds the homepage "Why Choose Gold Point" cards with what the website shows today
 * (MGP-WEB/src/components/home/TheGpDiff/TheGpDiff.tsx DEFAULT_CARDS).
 *
 * - Empty collection: creates the three cards with their images.
 * - Entries still carrying the original seeded titles (which the website ignores) are
 *   replaced with the matching current card. Entries an editor has renamed are left alone.
 */
const UID = 'api::difference-box.difference-box';

const ASSET_DIR_CANDIDATES = [
  path.join(__dirname, 'assets', 'difference-boxes'),
  // Compiled builds run from dist/src/seed; the images stay in src/seed/assets.
  path.join(process.cwd(), 'src', 'seed', 'assets', 'difference-boxes'),
];

const CURRENT_BOXES = [
  {
    order: 1,
    boxTitle: 'Supporting India’s Economy',
    boxDescription: 'We recycle old gold and bring it back into circulation, helping reduce India’s dependence on imported gold.',
    iconType: 'rupee' as const,
    image: 'GDP3.jpg',
  },
  {
    order: 2,
    boxTitle: 'Protecting the Environment',
    boxDescription: 'Gold recycling reduces the need for mining, helping save natural resources and reduce environmental damage.',
    iconType: 'leaf' as const,
    image: 'GDP1.jpg',
  },
  {
    order: 3,
    boxTitle: 'Transparent and Reliable Process',
    boxDescription: 'We use scientific methods to evaluate gold, giving customers a transparent and reliable way to sell their unused gold.',
    iconType: 'scale' as const,
    image: 'GDP2.jpg',
  },
];

// Titles of the original seed, mapped to the current card that replaces each one.
const LEGACY_TITLES: Record<string, number> = {
  'xrf over touchstone': 0,
  'three-decimal weight': 1,
  'bank transfer, not cash-only': 2,
};

async function uploadImage(strapi: Core.Strapi, fileName: string): Promise<number | undefined> {
  const filepath = ASSET_DIR_CANDIDATES.map((dir) => path.join(dir, fileName)).find((p) => fs.existsSync(p));
  if (!filepath) {
    strapi.log.warn(`Difference Box seed image not found: ${fileName}`);
    return undefined;
  }
  try {
    const [file] = await strapi.plugin('upload').service('upload').upload({
      data: { fileInfo: { name: fileName, alternativeText: fileName.replace(/\.\w+$/, '') } },
      files: {
        filepath,
        originalFilename: fileName,
        mimetype: 'image/jpeg',
        size: fs.statSync(filepath).size,
      },
    });
    return file?.id;
  } catch (err) {
    strapi.log.warn(`Difference Box seed image upload failed for ${fileName}: ${err instanceof Error ? err.message : err}`);
    return undefined;
  }
}

async function toData(strapi: Core.Strapi, box: (typeof CURRENT_BOXES)[number]) {
  const { image, ...fields } = box;
  const boxImage = await uploadImage(strapi, image);
  return boxImage ? { ...fields, boxImage } : fields;
}

export async function seedDifferenceBoxes(strapi: Core.Strapi) {
  const existing = await strapi.documents(UID).findMany({ limit: 100 });

  if (existing.length === 0) {
    strapi.log.info('Seeding Difference Boxes...');
    for (const box of CURRENT_BOXES) {
      await strapi.documents(UID).create({ data: (await toData(strapi, box)) as any });
    }
    return;
  }

  for (const entry of existing as any[]) {
    const idx = LEGACY_TITLES[(entry.boxTitle || '').trim().toLowerCase()];
    if (idx === undefined) continue;
    strapi.log.info(`Replacing legacy Difference Box "${entry.boxTitle}" with "${CURRENT_BOXES[idx].boxTitle}"`);
    await strapi.documents(UID).update({
      documentId: entry.documentId,
      data: (await toData(strapi, CURRENT_BOXES[idx])) as any,
    });
  }
}
