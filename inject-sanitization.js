const fs = require('fs');
const path = require('path');

const files = [
  'src/api/contact-submission/controllers/contact-submission.ts',
  'src/api/mobile-van-submission/controllers/mobile-van-submission.ts',
  'src/api/gold-valuation-submission/controllers/gold-valuation-submission.ts',
  'src/api/blog-enquiry/controllers/blog-enquiry.ts',
  'src/api/enquiry/controllers/enquiry.ts',
  'src/api/job-application/controllers/job-application.ts',
  'src/api/all-lead/controllers/all-lead.ts',
  'src/api/otp-request/controllers/otp-request.ts'
];

const validationInjectCode = `
      // Inject sanitization
      try {
        const { sanitizePayload, validateStringLengths } = require('../../../utils/sanitize-input');
        if (ctx.request.body) {
          if (!validateStringLengths(ctx.request.body)) {
            ctx.status = 400;
            ctx.body = { success: false, message: 'Payload contains strings that are too long' };
            return;
          }
          ctx.request.body = sanitizePayload(ctx.request.body);
        }
      } catch (err) {
        // Ignore if file not found, but it should exist
      }
`;

files.forEach(f => {
  const filePath = path.join(__dirname, f);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Inject at start of create(ctx: Context) {
    if (content.includes('async create(ctx: Context) {')) {
      content = content.replace(/(async\s+create\s*\(\s*ctx:\s*Context\s*\)\s*\{)/, "$1\n" + validationInjectCode);
    }
    
    // Also inject at start of verifyOtp(ctx: Context) { since it reads fields too
    if (content.includes('async verifyOtp(ctx: Context) {')) {
      content = content.replace(/(async\s+verifyOtp\s*\(\s*ctx:\s*Context\s*\)\s*\{)/, "$1\n" + validationInjectCode);
    }

    fs.writeFileSync(filePath, content);
  }
});
