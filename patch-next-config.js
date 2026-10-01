const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../MGP-WEB/next.config.ts');
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace headers section
  const headersCode = `
    async headers() {
      const isDev = process.env.NODE_ENV !== "production";
      const csp = \`
        default-src 'self';
        script-src 'self' \${isDev ? "'unsafe-inline' 'unsafe-eval'" : ""};
        style-src 'self' 'unsafe-inline';
        img-src 'self' blob: data: https:;
        font-src 'self' data: https:;
        connect-src 'self' https:;
        frame-ancestors 'self' \${publicStrapiUrl ?? ""};
      \`.replace(/\\s{2,}/g, ' ').trim();

      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Content-Security-Policy",
              value: csp,
            },
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            }
          ],
        },
      ];
    },
  `;

  content = content.replace(/async\s+headers\(\)\s*\{\s*return\s*\[[\s\S]*?\];\s*\},/, headersCode.trim() + ',');

  fs.writeFileSync(file, content);
  console.log("Patched next.config.ts");
} else {
  console.error("Not found");
}
