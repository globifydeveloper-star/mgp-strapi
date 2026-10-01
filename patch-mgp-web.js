const fs = require('fs');
const path = require('path');

const helperContent = `import { NextRequest } from 'next/server';

export const getClientIp = (request: NextRequest): string => {
  if (process.env.TRUST_CLOUDFRONT_VIEWER_HEADER === 'true') {
    const cfHeader = request.headers.get('cloudfront-viewer-address');
    if (cfHeader) {
      const ip = cfHeader.split(':')[0];
      if (ip) return ip.trim();
    }
  }

  const trustedProxyCount = parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10);
  const forwarded = request.headers.get('x-forwarded-for');
  let forwardedArray: string[] = [];
  
  if (forwarded) {
    forwardedArray = forwarded.split(',').map(s => s.trim());
  }

  if (forwardedArray.length > 0) {
    const index = forwardedArray.length - trustedProxyCount;
    if (index >= 0 && index < forwardedArray.length) {
      return forwardedArray[index];
    }
  }

  return request.ip || '127.0.0.1';
};
`;

fs.writeFileSync(path.join(__dirname, '../MGP-WEB/src/lib/getClientIp.ts'), helperContent);

const routeFile = path.join(__dirname, '../MGP-WEB/src/app/api/gold-quote/route.ts');
if (fs.existsSync(routeFile)) {
  let routeContent = fs.readFileSync(routeFile, 'utf8');
  
  routeContent = routeContent.replace(
    "import { fetchGoldQuote, fetchAllGoldRates, checkRateLimit } from '@/lib/goldQuoteService';",
    "import { fetchGoldQuote, fetchAllGoldRates, checkRateLimit } from '@/lib/goldQuoteService';\nimport { getClientIp } from '@/lib/getClientIp';"
  );
  
  routeContent = routeContent.replace(
    /const forwarded = request\.headers\.get\('x-forwarded-for'\);\s*const clientIp = forwarded \? forwarded\.split\(\',\/\)\[0\]\.trim\(\) : '127\.0\.0\.1';/g,
    "const clientIp = getClientIp(request);"
  );
  // Need simpler replace just in case regex is wrong
  routeContent = routeContent.replaceAll(
    "const forwarded = request.headers.get('x-forwarded-for');\n    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';",
    "const clientIp = getClientIp(request);"
  );

  fs.writeFileSync(routeFile, routeContent);
  console.log("Patched MGP-WEB route!");
} else {
  console.error("Could not find route.ts in MGP-WEB");
}
