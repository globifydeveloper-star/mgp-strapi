const fs = require('fs');
const path = require('path');

const pageFile = 'd:\\MGP\\MGP-WEB\\src\\components\\career\\page.tsx';
let content = fs.readFileSync(pageFile, 'utf8');

// Insert interface if it doesn't exist
if (!content.includes('interface CareerPageProps')) {
  content = content.replace(
    `import Navbar from '@/components/layout/Navbar';`,
    `import Navbar from '@/components/layout/Navbar';\nimport { CareerPageSettingsData } from '@/lib/strapi';`
  );

  content = content.replace(
    `export default function CareerPage() {`,
    `interface CareerPageProps { data?: CareerPageSettingsData | null; }\n\nexport default function CareerPage({ data }: CareerPageProps) {`
  );
  
  content = content.replace(
    `<CareerHero />`,
    `<CareerHero data={data} />`
  );

  content = content.replace(
    `<CareerBenefits />`,
    `<CareerBenefits data={data} />`
  );
  
  fs.writeFileSync(pageFile, content);
  console.log('Successfully updated career/page.tsx');
} else {
  console.log('Already updated');
}
