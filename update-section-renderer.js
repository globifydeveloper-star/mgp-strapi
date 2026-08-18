const fs = require('fs');
const path = require('path');

const file = 'd:\\MGP\\MGP-WEB\\src\\components\\page-builder\\SectionRenderer.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import ReactMarkdown from')) {
  content = content.replace(
    `import OTPEnquiryForm from '@/components/common/OTPEnquiryForm/OTPEnquiryForm';`,
    `import OTPEnquiryForm from '@/components/common/OTPEnquiryForm/OTPEnquiryForm';\nimport ReactMarkdown from 'react-markdown';`
  );

  const richTextCase = `          case 'sections.rich-text':
            return (
              <section key={key} className="container" style={{ padding: '40px 20px' }}>
                <div className="prose" style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
                  <ReactMarkdown>{section.content}</ReactMarkdown>
                </div>
              </section>
            );

          default:`;

  content = content.replace(`default:`, richTextCase);
  fs.writeFileSync(file, content);
  console.log('Successfully updated SectionRenderer.tsx');
} else {
  console.log('Already updated SectionRenderer.tsx');
}
