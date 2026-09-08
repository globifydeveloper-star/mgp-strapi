const fs = require('fs');
const path = require('path');

const file = 'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\abouthero\\abouthero.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Replace the hardcoded "Sell Your Gold" with the dynamic value
content = content.replace(
  /<button onClick={onExploreClick} className="about-hero-know-more">\s*Sell Your Gold\s*<\/button>/g,
  '<button onClick={onExploreClick} className="about-hero-know-more">\n                {data?.heroButtonText || \'Sell Your Gold\'}\n              </button>'
);

fs.writeFileSync(file, content);
console.log('Successfully patched abouthero.tsx');
