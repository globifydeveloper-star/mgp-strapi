// scripts/merge-image-formats.ts
//
// Fixes the fallout from reconcile-cloudinary-orphans.ts: each size variant
// (thumbnail_X, small_X, medium_X, large_X, X) landed as its own separate
// Strapi `files` row instead of living inside one parent record's `formats`
// JSON field. This script groups variants by their shared base name, merges
// them into the parent (the "original", no-prefix) record's `formats`
// field, and removes the now-redundant variant rows — WITHOUT touching
// anything on Cloudinary itself (the assets stay exactly where they are;
// only the extra Strapi DB rows get cleaned up).
//
// Usage:
//   npx tsx scripts/merge-image-formats.ts             # dry run, writes report
//   npx tsx scripts/merge-image-formats.ts --apply      # actually merges + deletes rows

import { createStrapi, compileStrapi } from '@strapi/strapi';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');
const REPORT_PATH = 'merge-formats-report.json';

const VARIANT_PREFIXES = ['thumbnail_', 'medium_', 'small_', 'large_'];

function splitVariant(name: string) {
    for (const prefix of VARIANT_PREFIXES) {
        if (name.startsWith(prefix)) {
            return { variant: prefix.slice(0, -1), baseName: name.slice(prefix.length) };
        }
    }
    return { variant: 'original', baseName: name };
}

async function main() {
    const appContext = await compileStrapi();
    const app = await createStrapi(appContext).load();
    app.log.level = 'error';

    const allFiles = await app.db.query('plugin::upload.file').findMany({
        select: [
            'id',
            'name',
            'url',
            'width',
            'height',
            'size',
            'ext',
            'mime',
            'hash',
            'provider',
            'provider_metadata',
            'formats',
        ],
    });

    console.log(`Loaded ${allFiles.length} file records.`);

    const groups = new Map<string, any[]>();
    for (const file of allFiles) {
        const { variant, baseName } = splitVariant(file.name);
        const key = baseName;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ ...file, variant });
    }

    const report = {
        generatedAt: new Date().toISOString(),
        merged: [] as any[],
        noOriginal: [] as any[],
        singleFileGroups: [] as any[],
    };

    let mergedCount = 0;
    let deletedRowCount = 0;
    let skippedNoOriginal = 0;

    for (const [baseName, members] of groups) {
        if (members.length === 1) {
            // Nothing to merge — likely never had breakpoints (e.g. svg/icon), leave as is.
            report.singleFileGroups.push({ baseName, name: members[0].name });
            continue;
        }

        const original = members.find((m) => m.variant === 'original');
        const variants = members.filter((m) => m.variant !== 'original');

        if (!original) {
            // No unprefixed record exists — can't merge safely, flag for manual review.
            report.noOriginal.push({ baseName, members: members.map((m) => ({ id: m.id, name: m.name, variant: m.variant })) });
            skippedNoOriginal += 1;
            continue;
        }

        const formats: Record<string, any> = original.formats || {};
        for (const v of variants) {
            formats[v.variant] = {
                name: v.name,
                hash: v.hash,
                ext: v.ext,
                mime: v.mime,
                width: v.width,
                height: v.height,
                size: v.size,
                sizeInBytes: Math.round((v.size || 0) * 1024),
                path: null,
                url: v.url,
                provider_metadata: v.provider_metadata,
            };
        }

        report.merged.push({
            originalId: original.id,
            originalName: original.name,
            mergedVariants: variants.map((v) => ({ id: v.id, name: v.name, variant: v.variant })),
        });

        if (APPLY) {
            await app.db.query('plugin::upload.file').update({
                where: { id: original.id },
                data: { formats },
            });

            for (const v of variants) {
                await app.db.query('plugin::upload.file').delete({ where: { id: v.id } });
                deletedRowCount += 1;
            }
        }

        mergedCount += 1;
    }

    console.log(`\nGroups mergeable: ${mergedCount}`);
    console.log(`Groups with no original/base record (skipped, needs manual review): ${skippedNoOriginal}`);
    console.log(`Single-file groups (no variants, untouched): ${report.singleFileGroups.length}`);

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`Report written to ${REPORT_PATH}`);

    if (!APPLY) {
        console.log('\nDry run only — no records changed. Re-run with --apply to merge and delete redundant rows.');
    } else {
        console.log(`\nDone. ${mergedCount} parent records updated with formats, ${deletedRowCount} redundant rows deleted.`);
    }

    await app.destroy();
    process.exit(0);
}

main().catch((err) => {
    console.error('Merge failed:', err);
    process.exit(1);
});