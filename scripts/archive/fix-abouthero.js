const fs = require('fs');

function fixAboutHeroProp() {
  const file = 'd:\\MGP\\MGP-WEB\\src\\components\\about-us\\abouthero\\abouthero.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    `data: AboutUsPageData;`,
    `data?: AboutUsPageData | null;`
  );
  fs.writeFileSync(file, content);
  console.log('Fixed AboutHero Prop');
}

fixAboutHeroProp();
