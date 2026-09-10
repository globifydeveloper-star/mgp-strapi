const fs = require('fs');

function updateSchema(path, fieldName, description) {
  if (fs.existsSync(path)) {
    let raw = fs.readFileSync(path, 'utf8');
    let schema = JSON.parse(raw);

    if (schema.attributes && schema.attributes[fieldName]) {
      schema.attributes[fieldName].description = description;
      fs.writeFileSync(path, JSON.stringify(schema, null, 2) + '\n');
      console.log('Updated ' + path);
    }
  }
}

updateSchema(
  'd:\\MGP\\mgp-strapi\\src\\api\\promo-slide\\content-types\\promo-slide\\schema.json',
  'creativeImage',
  'Recommended: 1280 × 800 px (16:10 Aspect Ratio)'
);

updateSchema(
  'd:\\MGP\\mgp-strapi\\src\\api\\blog-post\\content-types\\blog-post\\schema.json',
  'coverMedia',
  'Recommended: 1920 × 1080 px (16:9 Aspect Ratio)'
);
