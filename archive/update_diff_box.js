const fs = require('fs');
const path = require('path');

const schemaPath = 'd:\\MGP\\mgp-strapi\\src\\api\\difference-box\\content-types\\difference-box\\schema.json';

if (fs.existsSync(schemaPath)) {
  let raw = fs.readFileSync(schemaPath, 'utf8');
  let schema = JSON.parse(raw);

  if (schema.attributes && schema.attributes.boxImage) {
    schema.attributes.boxImage.description = 'Recommended: 1280 × 800 px (16:10 Aspect Ratio)';
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');
    console.log('Updated difference-box schema successfully.');
  } else {
    console.log('boxImage attribute not found');
  }
} else {
  console.log('Schema not found');
}
