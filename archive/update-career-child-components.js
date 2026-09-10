const fs = require('fs');
const path = require('path');

const heroFile = 'd:\\MGP\\MGP-WEB\\src\\components\\career\\careerhero\\careerhero.tsx';
let heroContent = fs.readFileSync(heroFile, 'utf8');

if (!heroContent.includes('interface CareerHeroProps')) {
  heroContent = heroContent.replace(
    `import Image from 'next/image';`,
    `import Image from 'next/image';\nimport { CareerPageSettingsData } from '@/lib/strapi';`
  );

  heroContent = heroContent.replace(
    `export default function CareerHero() {`,
    `interface CareerHeroProps { data?: CareerPageSettingsData | null; }\n\nexport default function CareerHero({ data }: CareerHeroProps) {`
  );

  heroContent = heroContent.replace(
    `<h1 className="career-hero-title">
              Be Part of India's <span className="gold-text">Gold Revolution</span>
            </h1>`,
    `<h1 className="career-hero-title">
              {data?.heroHeading ? (
                <>
                  {data.heroHeading.split(' ').slice(0, -2).join(' ')} <span className="gold-text">{data.heroHeading.split(' ').slice(-2).join(' ')}</span>
                </>
              ) : (
                <>Be Part of India's <span className="gold-text">Gold Revolution</span></>
              )}
            </h1>`
  );

  heroContent = heroContent.replace(
    `<p className="career-hero-desc">
              At Muthoot Gold Point, we don't just recycle gold—we build careers. Join a dynamic team driven by transparency, innovation, and the 133+ year legacy of the Muthoot Pappachan Group.
            </p>`,
    `<p className="career-hero-desc">
              {data?.heroSubheading || "At Muthoot Gold Point, we don't just recycle gold—we build careers. Join a dynamic team driven by transparency, innovation, and the 133+ year legacy of the Muthoot Pappachan Group."}
            </p>`
  );

  fs.writeFileSync(heroFile, heroContent);
}

const benefitsFile = 'd:\\MGP\\MGP-WEB\\src\\components\\career\\careerbenefits\\careerbenefits.tsx';
let benefitsContent = fs.readFileSync(benefitsFile, 'utf8');

if (!benefitsContent.includes('interface CareerBenefitsProps')) {
  benefitsContent = benefitsContent.replace(
    `import './careerbenefits.css';`,
    `import './careerbenefits.css';\nimport { CareerPageSettingsData } from '@/lib/strapi';`
  );

  benefitsContent = benefitsContent.replace(
    `export default function CareerBenefits() {`,
    `interface CareerBenefitsProps { data?: CareerPageSettingsData | null; }\n\nexport default function CareerBenefits({ data }: CareerBenefitsProps) {`
  );

  const oldTitle = `<h2 className="career-benefits-title">Why Join Muthoot Gold Point?</h2>`;
  const newTitle = `<h2 className="career-benefits-title">{data?.cultureHeading || "Why Join Muthoot Gold Point?"}</h2>`;
  benefitsContent = benefitsContent.replace(oldTitle, newTitle);

  const oldDesc = `<p className="career-benefits-desc">
          We believe in empowering our employees with a work environment that fosters growth, learning, and well-being.
        </p>`;
  const newDesc = `<p className="career-benefits-desc">{data?.cultureDescription || "We believe in empowering our employees with a work environment that fosters growth, learning, and well-being."}</p>`;
  benefitsContent = benefitsContent.replace(oldDesc, newDesc);

  fs.writeFileSync(benefitsFile, benefitsContent);
}

console.log('Successfully updated careerhero and careerbenefits');
