/**
 * scripts/migrate-media-to-s3.ts
 *
 * Migrates any Media Library file NOT already on AWS S3 (e.g. still on
 * Cloudinary, R2, or local /uploads/) onto AWS S3 in place — updating the
 * Strapi Media Library entries to new S3 URLs, including all responsive formats.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/migrate-media-to-s3.ts   // preview only, no writes
 *   npx tsx scripts/migrate-media-to-s3.ts                // actually migrates
 */

import path from 'path';
import fs from 'fs/promises';
import { createStrapi, compileStrapi } from '@strapi/strapi';

const DRY_RUN = process.env.DRY_RUN === 'true';
const S3_MARKER = 'amazonaws.com';

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
    console.log(`Starting media migration script (Dry run: ${DRY_RUN})...`);
    console.log('Compiling and initializing Strapi instance (please wait)...');
    const app = await compileStrapi();
    const strapi = await createStrapi(app).load();

    try {
        const provider = strapi.plugin('upload').provider;

        const files = await strapi.db.query('plugin::upload.file').findMany({
            where: {
                url: { $notContains: S3_MARKER },
            },
        });

        console.log(`Found ${files.length} files to migrate to AWS S3. Dry run: ${DRY_RUN}`);

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
