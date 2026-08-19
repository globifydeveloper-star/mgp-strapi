const fs = require('fs');
const path = require('path');

const components = [
  'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\goldrecycling\\goldrecycling.tsx',
  'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\history\\history.tsx',
  'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\muthootblue\\muthootblue.tsx',
  'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\standtoday\\standtoday.tsx',
  'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\philanthropy\\philanthropy.tsx'
];

components.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    if (!content.includes('import { AboutUsPageData }')) {
      content = content.replace(
        `import './`,
        `import { AboutUsPageData } from '@/lib/strapi';\nimport './`
      );
      // fallback if no css import
      if (!content.includes('import { AboutUsPageData }')) {
         content = `import { AboutUsPageData } from '@/lib/strapi';\n` + content;
      }
    }

    const componentName = path.basename(file, '.tsx').replace(/^./, str => str.toUpperCase());
    
    // Find "export default function ComponentName() {"
    const regex = new RegExp(`export default function ${componentName}\\s*\\(\\)\\s*{`);
    if (regex.test(content)) {
      content = content.replace(
        regex,
        `interface ${componentName}Props { data?: AboutUsPageData | null; }\n\nexport default function ${componentName}({ data }: ${componentName}Props) {`
      );
      fs.writeFileSync(file, content);
      console.log(`Updated ${componentName}`);
    } else {
      // It might be named differently inside the file. 
      // For instance: export default function GoldRecycling() {
      const match = content.match(/export default function ([A-Za-z0-9_]+)\s*\(\)\s*{/);
      if (match) {
        const actualName = match[1];
        content = content.replace(
          match[0],
          `interface ${actualName}Props { data?: AboutUsPageData | null; }\n\nexport default function ${actualName}({ data }: ${actualName}Props) {`
        );
        fs.writeFileSync(file, content);
        console.log(`Updated ${actualName} in ${file}`);
      } else {
        console.log(`Could not find export for ${file}`);
      }
    }
  }
});
