const fs = require('fs');
const path = require('path');

const basePath = 'd:\\MGP\\mgp-strapi\\src\\api';

const updates = [
  {
    collection: 'process-step',
    fields: [
      { name: 'stepImage', desc: 'Recommended: 1920 × 1080 px (16:9 Aspect Ratio)' }
    ]
  },
  {
    collection: 'homepage',
    fields: [
      { name: 'estimateGoldImage', desc: 'Recommended: 1600 × 1050 px (16:10.5 Aspect Ratio)' }
    ]
  },
  {
    collection: 'gold-rate-page',
    fields: [
      { name: 'estimateGoldImage', desc: 'Recommended: 1600 × 1050 px (16:10.5 Aspect Ratio)' }
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
      if (schema.attributes[field.name]) {
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
  }
});
console.log('Strapi dimensions corrected.');
