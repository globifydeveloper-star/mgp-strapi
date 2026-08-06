/**
 * scripts/migrate-cloudinary-to-r2.ts
 *
 * Migrates every Media Library file NOT already on R2 (i.e. still on
 * Cloudinary, or still a local /uploads/ path from before Cloudinary was
 * ever wired up) onto R2, in place — same Media Library entries, just
 * repointed at new R2 URLs. Handles the responsive format variants too
 * (thumbnail/small/medium/large), not just the original.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/migrate-cloudinary-to-r2.ts   // preview only, no writes
 *   npx tsx scripts/migrate-cloudinary-to-r2.ts                // actually migrates
 *
 * IMPORTANT:
 *   - Run DRY_RUN=true first and read the console output before running for real.
 *   - Test against a non-production Strapi instance / DB copy first (per your
 *     own workflow rule for anything transfer/migration-related).
 *   - Requires plugins.ts already switched to the R2 provider (aws-s3 + R2
 *     endpoint) — this script uses whatever provider is currently configured.
 */

import path from 'path';
import fs from 'fs/promises';
import { createStrapi, compileStrapi } from '@strapi/strapi';

const DRY_RUN = process.env.DRY_RUN === 'true';
const R2_PUBLIC_MARKER = process.env.R2_PUBLIC_URL_MARKER ?? 'r2.dev'; // change to your custom domain once cut over

async function getFileBuffer(strapi: any, url: string): Promise<Buffer> {
    if (url.startsWith('http')) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
        return Buffer.from(await res.arrayBuffer());
    }
    // relative path -> local file still sitting in public/uploads
    const localPath = path.join(strapi.dirs.static.public, url);
    return fs.readFile(localPath);
}

async function run() {
    const app = await compileStrapi();
    const strapi = await createStrapi(app).load();

    try {
        const provider = strapi.plugin('upload').provider;

        const files = await strapi.db.query('plugin::upload.file').findMany({
            where: {
                url: { $notContains: R2_PUBLIC_MARKER },
            },
        });

        console.log(`Found ${files.length} files to migrate. Dry run: ${DRY_RUN}`);

        let success = 0;
        let failed = 0;

        for (const file of files) {
            try {
                console.log(`\nMigrating: ${file.name} (id ${file.id}) — currently: ${file.url}`);

                const buffer = await getFileBuffer(strapi, file.url);

                const fileData: any = {
                    name: file.name,
                    hash: file.hash,
                    ext: file.ext,
                    mime: file.mime,
                    size: file.size,
                    buffer,
                };

                if (!DRY_RUN) {
                    await provider.upload(fileData);
                }
                const newUrl = fileData.url ?? `[dry-run: would upload as ${file.hash}${file.ext}]`;

                // migrate each responsive format variant too
                const newFormats: Record<string, any> = {};
                if (file.formats) {
                    for (const [key, fmt] of Object.entries<any>(file.formats)) {
                        try {
                            console.log(`  ↳ format "${key}": ${fmt.url}`);
                            const fmtBuffer = await getFileBuffer(strapi, fmt.url);
                            const fmtData: any = {
                                name: fmt.name,
                                hash: fmt.hash,
                                ext: fmt.ext,
                                mime: fmt.mime,
                                size: fmt.size,
                                buffer: fmtBuffer,
                            };
                            if (!DRY_RUN) {
                                await provider.upload(fmtData);
                            }
                            newFormats[key] = { ...fmt, url: fmtData.url ?? fmt.url };
                        } catch (fmtErr) {
                            console.warn(`  ⚠ format "${key}" failed, keeping old reference:`, fmtErr);
                            newFormats[key] = fmt;
                        }
                    }
                }

                if (!DRY_RUN) {
                    await strapi.db.query('plugin::upload.file').update({
                        where: { id: file.id },
                        data: {
                            url: newUrl,
                            formats: file.formats ? newFormats : file.formats,
                            provider: 'aws-s3',
                        },
                    });
                }

                console.log(`  ✓ ${DRY_RUN ? 'would migrate' : 'migrated'} → ${newUrl}`);
                success++;
            } catch (err) {
                console.error(`  ✗ failed for file id ${file.id} (${file.name}):`, err);
                failed++;
            }
        }

        console.log(`\n--- Migration ${DRY_RUN ? 'preview' : 'run'} complete ---`);
        console.log(`Success: ${success}, Failed: ${failed}, Total: ${files.length}`);
        if (DRY_RUN) console.log('This was a dry run — no data was changed. Re-run without DRY_RUN=true to apply.');
    } finally {
        await strapi.destroy();
    }
}

run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});