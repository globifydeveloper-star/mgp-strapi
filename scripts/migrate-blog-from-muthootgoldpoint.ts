/**
 * scripts/migrate-blog-from-muthootgoldpoint.ts
 *
 * One-time authorized content migration: imports blog posts from
 * https://www.muthootgoldpoint.com/blog into the local `blog-post`
 * content type (title, slug, cover image, category, excerpt, body,
 * SEO meta fields).
 *
 * Source post list comes from the site's post-sitemap.xml, filtered to
 * English-only URLs (translated /hi/, /ml/, /ta/, /kn/, /bn/, /te/
 * variants are skipped). Already-imported posts (matched by slug) are
 * skipped on re-run, so the script is safe to resume after a failure.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/migrate-blog-from-muthootgoldpoint.ts   // preview only, no writes
 *   npx tsx scripts/migrate-blog-from-muthootgoldpoint.ts                // actually migrates
 *   LIMIT=5 npx tsx scripts/migrate-blog-from-muthootgoldpoint.ts        // only process the first N posts
 */

import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { createStrapi, compileStrapi } from '@strapi/strapi';

const SITE = 'https://www.muthootgoldpoint.com';
const SITEMAP_URL = `${SITE}/post-sitemap.xml`;
const DRY_RUN = process.env.DRY_RUN === 'true';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
const REQUEST_DELAY_MS = 500;
const USER_AGENT = 'Mozilla/5.0 (compatible; MGP-ContentMigration/1.0)';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText} for ${url}`);
    return res.text();
}

async function getEnglishPostUrls(): Promise<string[]> {
    const xml = await fetchText(SITEMAP_URL);
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls = new Set<string>();
    $('url > loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (!loc.startsWith(`${SITE}/blog/`)) return;
        const rest = loc.slice(`${SITE}/blog/`.length).replace(/\/$/, '');
        // skip category/author/tag/page sub-paths and translated variants (already filtered by prefix)
        if (!rest || rest.includes('/')) return;
        urls.add(loc);
    });
    return Array.from(urls).sort();
}

interface ScrapedPost {
    url: string;
    slug: string;
    title: string;
    excerpt: string;
    metaTitle: string;
    metaDescription: string;
    bodyHtml: string;
    categoryName: string | null;
    coverImageUrl: string | null;
    publishedAt: string | null;
}

function slugFromUrl(url: string): string {
    const parts = url.replace(/\/$/, '').split('/');
    const raw = parts[parts.length - 1];
    let decoded = raw;
    try {
        decoded = decodeURIComponent(raw);
    } catch {
        // malformed percent-encoding — fall back to the raw segment
    }
    return slugify(decoded);
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function scrapePost(url: string): Promise<ScrapedPost> {
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    const title = $('h1.blogTitle').first().text().trim();
    const metaTitle = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
    const publishedAt = $('meta[property="article:published_time"]').attr('content')?.trim() || null;
    const coverImageUrl =
        $('.single-blog-img img').first().attr('src')?.trim() ||
        $('meta[property="og:image"]').attr('content')?.trim() ||
        null;
    const categoryName = $('.single-blogMeta a[href*="/blog/category/"]').first().text().trim() || null;

    const bodyContainer = $('.blog-description').first().clone();
    bodyContainer.find('.next-prev-post').remove();
    const bodyHtml = bodyContainer.html()?.trim() || '';

    const excerpt = metaDescription || bodyContainer.find('p').first().text().trim().slice(0, 300);

    return {
        url,
        slug: slugFromUrl(url),
        title,
        excerpt,
        metaTitle,
        metaDescription,
        bodyHtml,
        categoryName,
        coverImageUrl,
        publishedAt,
    };
}

async function downloadToTempFile(url: string) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`image fetch failed: ${res.status} for ${url}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimetype = res.headers.get('content-type') || 'image/jpeg';
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const originalFilename = path.basename(new URL(url).pathname) || `cover${ext}`;
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mgp-blog-import-'));
    const filepath = path.join(tmpDir, originalFilename);
    await fs.writeFile(filepath, buffer);
    return { filepath, mimetype, size: buffer.length, originalFilename };
}

async function run() {
    console.log(`Starting blog migration from ${SITE} (Dry run: ${DRY_RUN}${LIMIT ? `, limit: ${LIMIT}` : ''})...`);
    console.log('Compiling and initializing Strapi instance (please wait)...');
    const app = await compileStrapi();
    const strapi = await createStrapi(app).load();

    let success = 0;
    let skipped = 0;
    let failed = 0;

    try {
        const urls = await getEnglishPostUrls();
        console.log(`Found ${urls.length} English blog posts on source site.`);
        const toProcess = LIMIT ? urls.slice(0, LIMIT) : urls;

        const categoryCache = new Map<string, string>(); // name -> documentId

        for (const url of toProcess) {
            const slug = slugFromUrl(url);
            try {
                const existing = await strapi.documents('api::blog-post.blog-post').findFirst({
                    filters: { slug },
                });
                if (existing) {
                    console.log(`- skip (already exists): ${slug}`);
                    skipped++;
                    await sleep(REQUEST_DELAY_MS);
                    continue;
                }

                console.log(`\nScraping: ${url}`);
                const post = await scrapePost(url);

                if (!post.title || !post.bodyHtml) {
                    throw new Error('missing title or body — selectors may not match this page');
                }

                let categoryDocumentId: string | undefined;
                if (post.categoryName) {
                    if (categoryCache.has(post.categoryName)) {
                        categoryDocumentId = categoryCache.get(post.categoryName);
                    } else {
                        const existingCategory = await strapi.documents('api::category.category').findFirst({
                            filters: { name: post.categoryName },
                        });
                        if (existingCategory) {
                            categoryDocumentId = existingCategory.documentId;
                        } else if (!DRY_RUN) {
                            const created = await strapi.documents('api::category.category').create({
                                data: { name: post.categoryName, slug: slugify(post.categoryName) } as any,
                                status: 'published',
                            });
                            categoryDocumentId = created.documentId;
                        }
                        if (categoryDocumentId) categoryCache.set(post.categoryName, categoryDocumentId);
                    }
                }

                let coverMediaId: number | undefined;
                if (post.coverImageUrl && !DRY_RUN) {
                    const { filepath, mimetype, size, originalFilename } = await downloadToTempFile(post.coverImageUrl);
                    try {
                        const [uploaded] = await strapi.plugin('upload').service('upload').upload({
                            data: { fileInfo: { alternativeText: post.title, caption: post.title } },
                            files: { filepath, originalFilename, mimetype, size } as any,
                        });
                        coverMediaId = uploaded.id;
                    } finally {
                        await fs.rm(path.dirname(filepath), { recursive: true, force: true });
                    }
                }

                console.log(`  title: ${post.title}`);
                console.log(`  category: ${post.categoryName ?? '(none)'}`);
                console.log(`  cover image: ${post.coverImageUrl ? (DRY_RUN ? '(would upload)' : 'uploaded') : '(none)'}`);

                if (!DRY_RUN) {
                    await strapi.documents('api::blog-post.blog-post').create({
                        data: {
                            title: post.title,
                            slug: post.slug,
                            excerpt: post.excerpt,
                            body: post.bodyHtml,
                            metaTitle: post.metaTitle,
                            metaDescription: post.metaDescription,
                            category: categoryDocumentId,
                            coverMedia: coverMediaId,
                            publishedAt: post.publishedAt ?? undefined,
                        } as any,
                        status: 'published',
                    });
                }

                console.log(`  ✓ ${DRY_RUN ? 'would import' : 'imported'}: ${slug}`);
                success++;
            } catch (err) {
                console.error(`  ✗ failed for ${slug}:`, err);
                failed++;
            }

            await sleep(REQUEST_DELAY_MS);
        }

        console.log(`\n--- Migration ${DRY_RUN ? 'preview' : 'run'} complete ---`);
        console.log(`Imported: ${success}, Skipped (existing): ${skipped}, Failed: ${failed}, Total: ${toProcess.length}`);
        if (DRY_RUN) console.log('This was a dry run — no data was changed. Re-run without DRY_RUN=true to apply.');
    } finally {
        await strapi.destroy();
    }
}

run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
