const fs = require('fs');
const path = require('path');

// 1. Patch lib/strapi.ts
const strapiFile = 'd:\\MGP\\MGP-WEB\\src\\lib\\strapi.ts';
let strapiCode = fs.readFileSync(strapiFile, 'utf8');

// Add to interface
strapiCode = strapiCode.replace(
  /export interface GoldRatePageData {([\s\S]*?)heroDescription\?: string;\n\s*faqs\?: FAQ\[\];\n}/,
  `export interface GoldRatePageData {$1heroDescription?: string;\n  faqs?: FAQ[];\n  estimateGoldImage?: string;\n}`
);

// Update fetch
strapiCode = strapiCode.replace(
  /api\/gold-rate-page\?populate=ogImage,faqs/g,
  `api/gold-rate-page?populate=ogImage,faqs,estimateGoldImage`
);

// Map estimateGoldImage
strapiCode = strapiCode.replace(
  /faqs: Array\.isArray\(flat\.faqs\)\s*\?\s*flat\.faqs\.map\(unwrap\)\s*:\s*\[\],/,
  `faqs: Array.isArray(flat.faqs) ? flat.faqs.map(unwrap) : [],\n      estimateGoldImage: flat.estimateGoldImage ? (resolveMediaUrl(unwrap(flat.estimateGoldImage).url) ?? unwrap(flat.estimateGoldImage).url) : undefined,`
);

fs.writeFileSync(strapiFile, strapiCode);

// 2. Patch gold-rate/page.tsx
const pageFile = 'd:\\MGP\\MGP-WEB\\src\\components\\gold-rate\\page.tsx';
let pageCode = fs.readFileSync(pageFile, 'utf8');

pageCode = pageCode.replace(
  /<GoldValueForm \/>/g,
  `<GoldValueForm sectionImage={data?.estimateGoldImage} />`
);

fs.writeFileSync(pageFile, pageCode);

console.log('Successfully patched frontend!');
