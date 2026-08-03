#!/usr/bin/env node
// @ts-nocheck -- one-off Node migration script; removed after a successful run.

import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const STRAPI_URL = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_API_TOKEN;
const MAX_UPLOAD_BYTES = Number(process.env.STRAPI_UPLOAD_LIMIT_BYTES || 200 * 1024 * 1024);
const REPORT_PATH = path.resolve(process.cwd(), 'migration-report.json');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const DEFAULT_SOURCE_DIRS = [
  path.resolve(process.cwd(), '../MGP-WEB/public'),
  path.resolve(process.cwd(), '../MGP-WEB/src/assets/images'),
];

// Only these literal filenames are safe to attach automatically. Add an alias
// only after a human has confirmed that it represents the corresponding field.
const HOMEPAGE_EXACT_MATCHES = {
  'hero-model.png': 'heroFirstSlideImage',
  'process-section.png': 'processSectionImage',
  'estimate-gold.png': 'estimateGoldImage',
  'mobile-van.png': 'vanImage',
  'homepage-og.png': 'ogImage',
};

function parseSourceDirs() {
  const requested = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--source' && process.argv[i + 1]) {
      requested.push(path.resolve(process.argv[++i]));
    }
  }
  return requested.length ? requested : DEFAULT_SOURCE_DIRS;
}

async function scanDirectory(directory) {
  const files = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await scanDirectory(fullPath));
    if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const stat = await fs.stat(fullPath);
      files.push({ sourceDirectory: directory, path: fullPath, filename: entry.name, size: stat.size });
    }
  }
  return files;
}

async function apiRequest(urlPath, options = {}) {
  return fetch(`${STRAPI_URL}${urlPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });
}

async function verifyAuthentication() {
  if (!TOKEN) {
    throw new Error('STRAPI_API_TOKEN is missing. Set it in the process environment before running this migration.');
  }
  let response;
  try {
    response = await apiRequest('/api/upload/files?pagination[pageSize]=1');
  } catch (error) {
    throw new Error(`Cannot reach Strapi at ${STRAPI_URL}: ${error.message}`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Strapi rejected STRAPI_API_TOKEN (${response.status}). Use a valid token with upload access.`);
  }
  if (!response.ok) {
    throw new Error(`Strapi upload authentication check failed: ${response.status} ${await response.text()}`);
  }
}

async function uploadFile(file) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      status: 'oversize',
      error: `File is ${file.size} bytes; configured upload limit is ${MAX_UPLOAD_BYTES} bytes`,
    };
  }

  const extension = path.extname(file.filename).toLowerCase();
  const stream = Readable.toWeb(createReadStream(file.path));
  const blob = await new Response(stream).blob();
  const form = new FormData();
  form.append('files', new File([blob], file.filename, { type: MIME_TYPES[extension] }));

  const response = await apiRequest('/api/upload', { method: 'POST', body: form });
  if (!response.ok) {
    const error = new Error(`${response.status} ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
  const uploaded = await response.json();
  if (!Array.isArray(uploaded) || !uploaded[0]?.id) {
    throw new Error(`Unexpected upload response: ${JSON.stringify(uploaded)}`);
  }
  return { status: 'uploaded', mediaId: uploaded[0].id, mediaUrl: uploaded[0].url };
}

async function autoLinkHomepage(successfulUploads) {
  const linked = [];
  const ambiguous = [];
  const candidatesByField = new Map();

  for (const upload of successfulUploads) {
    const field = HOMEPAGE_EXACT_MATCHES[upload.filename.toLowerCase()];
    if (!field) continue;
    if (!candidatesByField.has(field)) candidatesByField.set(field, []);
    candidatesByField.get(field).push(upload);
  }

  const data = {};
  for (const [field, candidates] of candidatesByField) {
    if (candidates.length === 1) {
      data[field] = candidates[0].mediaId;
      linked.push({ field, filename: candidates[0].filename, mediaId: candidates[0].mediaId });
    } else {
      ambiguous.push({ field, files: candidates.map((candidate) => candidate.sourcePath) });
    }
  }

  if (Object.keys(data).length) {
    const response = await apiRequest('/api/homepage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!response.ok) {
      throw new Error(`Homepage auto-link failed: ${response.status} ${await response.text()}`);
    }
  }
  return { linked, ambiguous };
}

async function main() {
  await verifyAuthentication();
  const sourceDirectories = parseSourceDirs();
  const files = [];
  for (const directory of sourceDirectories) {
    try {
      files.push(...await scanDirectory(directory));
    } catch (error) {
      throw new Error(`Cannot scan source directory ${directory}: ${error.message}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    strapiUrl: STRAPI_URL,
    sourceDirectories,
    uploadLimitBytes: MAX_UPLOAD_BYTES,
    totals: { discovered: files.length, uploaded: 0, failed: 0, oversize: 0 },
    files: [],
    homepageAutoLink: { linked: [], ambiguous: [], error: null },
    manualAssignmentRequired: [],
  };

  for (const file of files) {
    const base = {
      originalFilename: file.filename,
      sourcePath: path.relative(process.cwd(), file.path),
      sizeBytes: file.size,
    };
    try {
      const result = await uploadFile(file);
      report.files.push({ ...base, ...result });
      report.totals[result.status] += 1;
      console.log(`${result.status === 'uploaded' ? '✓' : '!'} ${file.filename}${result.mediaId ? ` → ${result.mediaId} → ${result.mediaUrl}` : ` → ${result.error}`}`);
    } catch (error) {
      report.files.push({ ...base, status: 'failed', error: error.message });
      report.totals.failed += 1;
      console.error(`✗ ${file.filename} → ${error.message}`);
      if (error.status === 401 || error.status === 403) {
        await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        throw new Error(
          `Strapi denied upload access (${error.status}). Create a Full access API token ` +
          `or grant the token permission for POST /api/upload, then run the migration again.`
        );
      }
    }
  }

  const uploaded = report.files.filter((file) => file.status === 'uploaded');
  try {
    report.homepageAutoLink = { ...await autoLinkHomepage(uploaded), error: null };
  } catch (error) {
    report.homepageAutoLink.error = error.message;
    console.error(error.message);
  }

  report.manualAssignmentRequired = uploaded
    .filter((file) => !report.homepageAutoLink.linked.some((link) => link.mediaId === file.mediaId))
    .map(({ originalFilename, sourcePath, mediaId, mediaUrl }) => ({ originalFilename, sourcePath, mediaId, mediaUrl }));

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.table(report.files.map((file) => ({
    filename: file.originalFilename,
    mediaId: file.mediaId || '-',
    mediaUrl: file.mediaUrl || file.error || '-',
  })));
  console.log(`Migration report written to ${REPORT_PATH}`);
  if (report.totals.failed || report.totals.oversize) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Asset migration aborted: ${error.message}`);
  process.exitCode = 1;
});
