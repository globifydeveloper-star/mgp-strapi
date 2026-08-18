const fs = require('fs');
const path = require('path');

const file = 'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\abouthero\\abouthero.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `import muthootLogo from '@/assets/images/muthootlogo.png';`,
  `import muthootLogo from '@/assets/images/muthootlogo.png';\nimport { AboutUsPageData } from '@/lib/strapi';`
);

content = content.replace(
  `interface AboutHeroProps {
  onExploreClick: () => void;
}`,
  `interface AboutHeroProps {
  onExploreClick: () => void;
  data?: AboutUsPageData;
}`
);

content = content.replace(
  `export default function AboutHero({ onExploreClick }: AboutHeroProps) {`,
  `export default function AboutHero({ onExploreClick, data }: AboutHeroProps) {`
);

content = content.replace(
  `<h1 className="about-hero-title">
              Muthoot Gold Point — Precision You Can <span className="gold-text">Trust</span>
            </h1>`,
  `<h1 className="about-hero-title">
              {data ? (
                <>
                  {data.heroTitle.split(' ').slice(0, -1).join(' ')} <span className="gold-text">{data.heroTitle.split(' ').slice(-1)}</span>
                </>
              ) : (
                <>Muthoot Gold Point — Precision You Can <span className="gold-text">Trust</span></>
              )}
            </h1>`
);

content = content.replace(
  `<p className="about-hero-desc">
              Muthoot Gold Point is a unit of Muthoot Exim (P) Ltd., the precious metal vertical of the Muthoot Pappachan Group, specialising in innovative products and offerings in the precious metal space. We are India&apos;s first national-level organised sector player in gold recycling — in sync with the Government of India&apos;s vision for the Indian gold industry — giving customers access to quality products at fair, transparent, and scientifically tested prices.
            </p>`,
  `<p className="about-hero-desc">
              {data ? data.heroDescription : "Muthoot Gold Point is a unit of Muthoot Exim (P) Ltd., the precious metal vertical of the Muthoot Pappachan Group, specialising in innovative products and offerings in the precious metal space. We are India's first national-level organised sector player in gold recycling — in sync with the Government of India's vision for the Indian gold industry — giving customers access to quality products at fair, transparent, and scientifically tested prices."}
            </p>`
);

// We need to replace the static list with data.heroChecklist
const oldList = `<ul className="about-hero-checklist">
              <li>
                <span className="check-icon" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                133+ years of Muthoot Pappachan Group legacy
              </li>
              <li>
                <span className="check-icon" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                India&apos;s first organised-sector gold recycler
              </li>
            </ul>`;

const newList = `<ul className="about-hero-checklist">
              {(data?.heroChecklist || ['133+ years of Muthoot Pappachan Group legacy', "India's first organised-sector gold recycler"]).map((item, idx) => (
                <li key={idx}>
                  <span className="check-icon" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  {item.text || item}
                </li>
              ))}
            </ul>`;

content = content.replace(oldList, newList);

fs.writeFileSync(file, content);
console.log('Successfully updated abouthero.tsx');
