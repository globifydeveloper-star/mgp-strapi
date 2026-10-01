const fs = require('fs');
const files = [
  'src/api/contact-submission/controllers/contact-submission.ts',
  'src/api/mobile-van-submission/controllers/mobile-van-submission.ts',
  'src/api/gold-valuation-submission/controllers/gold-valuation-submission.ts',
  'src/api/blog-enquiry/controllers/blog-enquiry.ts',
  'src/api/enquiry/controllers/enquiry.ts',
  'src/api/job-application/controllers/job-application.ts',
  'src/api/all-lead/controllers/all-lead.ts'
];

const checkCode = `
      if (process.env.REQUIRE_INTERNAL_SECRET === 'true') {
        const secret = ctx.request.headers['x-internal-secret'];
        const expected = process.env.INTERNAL_API_SECRET;
        if (!expected || !secret || typeof secret !== 'string' || secret !== expected) {
          ctx.status = 403;
          ctx.body = { success: false, message: 'Forbidden' };
          return;
        }
      }
`;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/(async\\s+create\\s*\\(\\s*ctx:\\s*Context\\s*\\)\\s*\\{)/, "$1" + checkCode);
  // Wait, double slashes mean it becomes a literal \s instead of a regex space class? 
  // Ah, let's fix the regex to not use a string literal, use a regex literal!
  content = content.replace(/(async\s+create\s*\(\s*ctx:\s*Context\s*\)\s*\{)/, "$1" + checkCode);
  fs.writeFileSync(f, content);
});
