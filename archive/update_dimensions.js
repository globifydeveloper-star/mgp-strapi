const fs = require('fs');
const path = require('path');

const basePath = 'd:\\MGP\\mgp-strapi\\src\\api';

const updates = [
  {
    collection: 'homepage',
    fields: [
      { name: 'heroFirstSlideImage', desc: 'Recommended: 1978 × 3215 px' },
      { name: 'vanImage', desc: 'Recommended: 1825 × 941 px' }
    ]
  },
  {
    collection: 'hero-slide',
    fields: [
      { name: 'heroImage', desc: 'Recommended: 1254 × 1254 px' }
    ]
  },
  {
    collection: 'process-step',
    fields: [
      { name: 'stepImage', desc: 'Recommended: 1536 × 1024 px (Process step) or ~800 × 800 px (Value gold)' }
    ]
  },
  {
    collection: 'difference-box',
    fields: [
      { name: 'boxImage', desc: 'Recommended: 206 × 210 px' }
    ]
  },
  {
    collection: 'promo-slide',
    fields: [
      { name: 'creativeImage', desc: 'Recommended: Varies' }
    ]
  },
  {
    collection: 'blog-post',
    fields: [
      { name: 'coverMedia', desc: 'Recommended: Varies' }
    ]
  },
  {
    collection: 'about-us-page',
    fields: [
      { name: 'heroImages', desc: 'Recommended: 1536 × 1024 px', multiple: true },
      { name: 'parentPortraitImage', desc: 'Recommended: 1978 × 3215 px' }
    ]
  },
  {
    collection: 'mobile-van-page',
    fields: [
      { name: 'heroImage', desc: 'Recommended: 4096 × 1408 px (background)' },
      { name: 'testingMethodsImage', desc: 'Recommended: 1541 × 1021 px' },
      { name: 'bookVanFormImage', desc: 'Recommended: 1825 × 941 px' }
    ]
  },
  {
    collection: 'gold-rate-page',
    fields: [
      { name: 'heroImage', desc: 'Recommended: 1920 × 1080 px' },
      { name: 'goldRateFormImage', desc: 'Recommended: ~800 × 800 px' },
      { name: 'whyGoldRateChangesImage', desc: 'Recommended: ~800 × 800 px' },
      { name: 'estimateGoldImage', desc: 'Recommended: ~800 × 800 px' }
    ]
  }
];

updates.forEach(update => {
  const schemaPath = path.join(basePath, update.collection, 'content-types', update.collection, 'schema.json');
  if (fs.existsSync(schemaPath)) {
    let raw = fs.readFileSync(schemaPath, 'utf8');
    let schema = JSON.parse(raw);
    let changed = false;

    update.fields.forEach(field => {
      if (!schema.attributes[field.name]) {
        // Add field if it doesn't exist
        schema.attributes[field.name] = {
          type: "media",
          multiple: field.multiple || false,
          allowedTypes: ["images", "files", "videos", "audios"],
          description: field.desc
        };
        changed = true;
      } else {
        // Update description if it exists
        if (schema.attributes[field.name].description !== field.desc) {
          schema.attributes[field.name].description = field.desc;
          changed = true;
        }
      }
    });

    if (changed) {
      fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');
      console.log(`Updated ${update.collection}`);
    }
  } else {
    console.error(`Schema not found: ${schemaPath}`);
  }
});

console.log('Done mapping dimensions.');
