const fs = require('fs');

function fixCareerHero() {
  const file = 'd:\\MGP\\MGP-WEB\\src\\components\\career\\careerhero\\careerhero.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    `interface CareerHeroProps {`,
    `import { CareerPageSettingsData } from '@/lib/strapi';\n\ninterface CareerHeroProps {\n  data?: CareerPageSettingsData | null;`
  );
  content = content.replace(
    `export default function CareerHero({ onApplyClick, onViewPositionsClick }: CareerHeroProps) {`,
    `export default function CareerHero({ data, onApplyClick, onViewPositionsClick }: CareerHeroProps) {`
  );
  fs.writeFileSync(file, content);
  console.log('Fixed CareerHero');
}

function fixCareerBenefits() {
  const file = 'd:\\MGP\\MGP-WEB\\src\\components\\career\\careerbenefits\\careerbenefits.tsx';
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('import { CareerPageSettingsData }')) {
       content = content.replace(`import React`, `import { CareerPageSettingsData } from '@/lib/strapi';\nimport React`);
    }
    content = content.replace(
      `export default function CareerBenefits() {`,
      `interface CareerBenefitsProps { data?: CareerPageSettingsData | null; }\nexport default function CareerBenefits({ data }: CareerBenefitsProps) {`
    );
    fs.writeFileSync(file, content);
    console.log('Fixed CareerBenefits');
  }
}

function fixContactPage() {
  const file = 'd:\\MGP\\MGP-WEB\\src\\components\\contact\\ContactPage.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    `export default function ContactPage({ data }: ContactPageProps) {`,
    `export default function ContactPage({ data }: { data?: ContactUsPageData | null }) {`
  );
  // Remove the old interface
  content = content.replace(/interface ContactPageProps {\s*data:\s*ContactUsPageData;\s*}/, '');
  fs.writeFileSync(file, content);
  console.log('Fixed ContactPage');
}

fixCareerHero();
fixCareerBenefits();
fixContactPage();
