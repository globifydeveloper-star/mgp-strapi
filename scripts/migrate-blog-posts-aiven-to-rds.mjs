/**
 * scripts/migrate-blog-posts-aiven-to-rds.mjs
 *
 * One-time migration: copies blog-post content (blog_posts, their categories,
 * cover media file metadata, and CTA components) from the old Aiven MySQL
 * database into the new AWS RDS MySQL database.
 *
 * Media files are referenced by external URL (Cloudinary / S3), so only file
 * *metadata* rows are copied — no binary transfer needed.
 *
 * Idempotent: safe to re-run. Existing rows (matched by document_id +
 * published/draft state) are skipped rather than duplicated.
 *
 * Usage (run from a machine with network access to BOTH databases, e.g. a
 * bastion host or an EC2 instance inside the RDS VPC):
 *
 *   SOURCE_HOST=mysql-1c7ea1e-mgp-database.f.aivencloud.com \
 *   SOURCE_PORT=13011 \
 *   SOURCE_USER=avnadmin \
 *   SOURCE_PASSWORD=*** \
 *   SOURCE_DATABASE=defaultdb \
 *   TARGET_HOST=goldpoint-uat.cbz0sadg29to.ap-south-1.rds.amazonaws.com \
 *   TARGET_PORT=3306 \
 *   TARGET_USER=goldpointqaadmin \
 *   TARGET_PASSWORD=*** \
 *   TARGET_DATABASE=goldpointuatadmin \
 *   DRY_RUN=true node scripts/migrate-blog-posts-aiven-to-rds.mjs
 *
 * Drop DRY_RUN to actually write.
 */

import mysql from 'mysql2/promise';

const DRY_RUN = process.env.DRY_RUN === 'true';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function connectFrom(prefix) {
  return mysql.createConnection({
    host: requireEnv(`${prefix}_HOST`),
    port: parseInt(process.env[`${prefix}_PORT`] || '3306', 10),
    user: requireEnv(`${prefix}_USER`),
    password: requireEnv(`${prefix}_PASSWORD`),
    database: requireEnv(`${prefix}_DATABASE`),
    ssl: { rejectUnauthorized: false },
  });
}

async function findExistingId(target, table, documentId, publishedAt) {
  const [rows] = await target.query(
    `SELECT id FROM \`${table}\` WHERE document_id = ? AND ${publishedAt === null ? 'published_at IS NULL' : 'published_at IS NOT NULL'} LIMIT 1`,
    [documentId]
  );
  return rows.length ? rows[0].id : null;
}

async function run() {
  const source = await connectFrom('SOURCE');
  const target = await connectFrom('TARGET');
  console.log(`Dry run: ${DRY_RUN}`);

  const stats = { categories: 0, files: 0, components: 0, posts: 0, skippedPosts: 0 };

  try {
    // 1. Categories
    const [categories] = await source.query('SELECT * FROM categories ORDER BY id');
    const categoryIdMap = new Map(); // old row id -> new row id

    for (const cat of categories) {
      const existingId = await findExistingId(target, 'categories', cat.document_id, cat.published_at);
      if (existingId) {
        categoryIdMap.set(cat.id, existingId);
        continue;
      }
      if (DRY_RUN) {
        categoryIdMap.set(cat.id, -1); // placeholder
        stats.categories++;
        continue;
      }
      const [result] = await target.query(
        `INSERT INTO categories (document_id, name, slug, created_at, updated_at, published_at, locale)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cat.document_id, cat.name, cat.slug, cat.created_at, cat.updated_at, cat.published_at, cat.locale]
      );
      categoryIdMap.set(cat.id, result.insertId);
      stats.categories++;
    }
    console.log(`Categories: ${stats.categories} new, ${categories.length - stats.categories} already present`);

    // 2. Blog posts (both draft and published rows)
    const [posts] = await source.query('SELECT * FROM blog_posts ORDER BY id');
    const postIdMap = new Map(); // old row id -> new row id
    const postsToMigrate = [];

    for (const post of posts) {
      const existingId = await findExistingId(target, 'blog_posts', post.document_id, post.published_at);
      if (existingId) {
        postIdMap.set(post.id, existingId);
        stats.skippedPosts++;
        continue;
      }
      postsToMigrate.push(post);
    }
    console.log(`Blog posts: ${postsToMigrate.length} to migrate, ${stats.skippedPosts} already present`);

    // 3. Cover media files referenced by the posts we're migrating
    const postIdsToMigrate = postsToMigrate.map((p) => p.id);
    let mphRows = [];
    if (postIdsToMigrate.length) {
      const [rows] = await source.query(
        `SELECT * FROM files_related_mph WHERE related_type = 'api::blog-post.blog-post' AND related_id IN (?)`,
        [postIdsToMigrate]
      );
      mphRows = rows;
    }
    const fileIds = [...new Set(mphRows.map((r) => r.file_id))];
    const fileIdMap = new Map(); // old file id -> new file id

    if (fileIds.length) {
      const [files] = await source.query(`SELECT * FROM files WHERE id IN (?)`, [fileIds]);
      for (const file of files) {
        const [existing] = await target.query('SELECT id FROM files WHERE hash = ? LIMIT 1', [file.hash]);
        if (existing.length) {
          fileIdMap.set(file.id, existing[0].id);
          continue;
        }
        if (DRY_RUN) {
          fileIdMap.set(file.id, -1);
          stats.files++;
          continue;
        }
        const [result] = await target.query(
          `INSERT INTO files
            (document_id, name, alternative_text, caption, focal_point, width, height, formats, hash, ext, mime, size, url, preview_url, provider, provider_metadata, folder_path, created_at, updated_at, published_at, locale)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            file.document_id, file.name, file.alternative_text, file.caption, file.focal_point, file.width, file.height,
            file.formats, file.hash, file.ext, file.mime, file.size, file.url, file.preview_url, file.provider,
            file.provider_metadata, file.folder_path, file.created_at, file.updated_at, file.published_at, file.locale,
          ]
        );
        fileIdMap.set(file.id, result.insertId);
        stats.files++;
      }
    }
    console.log(`Cover media files: ${stats.files} new, ${fileIds.length - stats.files} already present`);

    // 4. CTA components referenced by the posts we're migrating
    let cmpsRows = [];
    if (postIdsToMigrate.length) {
      const [rows] = await source.query(
        `SELECT * FROM blog_posts_cmps WHERE entity_id IN (?)`,
        [postIdsToMigrate]
      );
      cmpsRows = rows;
    }
    const cmpIds = [...new Set(cmpsRows.map((r) => r.cmp_id))];
    const cmpIdMap = new Map(); // old component id -> new component id

    if (cmpIds.length) {
      const [components] = await source.query(`SELECT * FROM components_blog_ctas WHERE id IN (?)`, [cmpIds]);
      for (const cmp of components) {
        if (DRY_RUN) {
          cmpIdMap.set(cmp.id, -1);
          stats.components++;
          continue;
        }
        const [result] = await target.query(
          `INSERT INTO components_blog_ctas (enabled, label, link) VALUES (?, ?, ?)`,
          [cmp.enabled, cmp.label, cmp.link]
        );
        cmpIdMap.set(cmp.id, result.insertId);
        stats.components++;
      }
    }
    console.log(`CTA components: ${stats.components} new`);

    // 5. Insert the blog_posts rows themselves
    for (const post of postsToMigrate) {
      if (DRY_RUN) {
        console.log(`  (dry run) would insert post: ${post.slug} [${post.document_id}] published=${!!post.published_at}`);
        stats.posts++;
        continue;
      }
      const [result] = await target.query(
        `INSERT INTO blog_posts (document_id, title, slug, excerpt, body, meta_title, meta_description, created_at, updated_at, published_at, locale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          post.document_id, post.title, post.slug, post.excerpt, post.body, post.meta_title, post.meta_description,
          post.created_at, post.updated_at, post.published_at, post.locale,
        ]
      );
      postIdMap.set(post.id, result.insertId);
      stats.posts++;
    }
    console.log(`Blog posts inserted: ${stats.posts}`);

    if (DRY_RUN) {
      console.log('\nDry run complete — no data was written. Re-run without DRY_RUN=true to apply.');
      return;
    }

    // 6. Category links
    const [catLnks] = await source.query(
      `SELECT * FROM blog_posts_category_lnk WHERE blog_post_id IN (?)`,
      [postIdsToMigrate.length ? postIdsToMigrate : [0]]
    );
    for (const lnk of catLnks) {
      const newPostId = postIdMap.get(lnk.blog_post_id);
      const newCatId = categoryIdMap.get(lnk.category_id);
      if (!newPostId || !newCatId) continue;
      await target.query(
        `INSERT INTO blog_posts_category_lnk (blog_post_id, category_id, blog_post_ord) VALUES (?, ?, ?)`,
        [newPostId, newCatId, lnk.blog_post_ord]
      );
    }
    console.log(`Category links inserted: ${catLnks.length}`);

    // 7. CTA component links
    for (const cmpLnk of cmpsRows) {
      const newEntityId = postIdMap.get(cmpLnk.entity_id);
      const newCmpId = cmpIdMap.get(cmpLnk.cmp_id);
      if (!newEntityId || !newCmpId) continue;
      await target.query(
        `INSERT INTO blog_posts_cmps (entity_id, cmp_id, component_type, field, \`order\`) VALUES (?, ?, ?, ?, ?)`,
        [newEntityId, newCmpId, cmpLnk.component_type, cmpLnk.field, cmpLnk.order]
      );
    }
    console.log(`CTA component links inserted: ${cmpsRows.length}`);

    // 8. Cover media links
    for (const mph of mphRows) {
      const newRelatedId = postIdMap.get(mph.related_id);
      const newFileId = fileIdMap.get(mph.file_id);
      if (!newRelatedId || !newFileId) continue;
      await target.query(
        `INSERT INTO files_related_mph (file_id, related_id, related_type, field, \`order\`) VALUES (?, ?, ?, ?, ?)`,
        [newFileId, newRelatedId, mph.related_type, mph.field, mph.order]
      );
    }
    console.log(`Cover media links inserted: ${mphRows.length}`);

    console.log('\nMigration complete.');
  } finally {
    await source.end();
    await target.end();
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
