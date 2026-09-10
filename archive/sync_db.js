const strapi = require('@strapi/strapi');

async function updateDescriptions() {
  console.log('Starting Strapi context to patch database...');
  const app = await strapi({ distDir: './dist' }).load();
  
  try {
    console.log('Fetching core store configurations...');
    const store = app.store({ type: 'plugin', name: 'content-manager' });
    
    // Find all content types
    const contentTypes = Object.keys(app.contentTypes).filter(uid => uid.startsWith('api::'));
    
    for (const uid of contentTypes) {
      const key = `configuration_content_types::${uid}`;
      const config = await store.get({ key });
      
      if (config && config.metadatas) {
        let modified = false;
        
        // Loop through the schema to find our injected descriptions
        const schemaAttributes = app.contentTypes[uid].attributes;
        
        for (const [attrName, attrDetails] of Object.entries(schemaAttributes)) {
          // If the schema has a description (which we just injected), force it into the DB
          if (attrDetails.description) {
            if (!config.metadatas[attrName]) {
              config.metadatas[attrName] = { edit: {}, list: {} };
            }
            if (config.metadatas[attrName].edit.description !== attrDetails.description) {
              config.metadatas[attrName].edit.description = attrDetails.description;
              modified = true;
            }
          }
        }
        
        if (modified) {
          await store.set({ key, value: config });
          console.log(`Updated database configuration for: ${uid}`);
        }
      }
    }
    console.log('Successfully synced all JSON descriptions into the database!');
  } catch (err) {
    console.error('Failed to update DB:', err);
  } finally {
    process.exit(0);
  }
}

updateDescriptions();
