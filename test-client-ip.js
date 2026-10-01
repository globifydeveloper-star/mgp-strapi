const { getClientIp } = require('./build/src/utils/get-client-ip.js');
const assert = require('assert');

// Test proxy logic
function runTests() {
  const createCtx = (headers) => ({ request: { headers } });

  // 1. TRUST_CLOUDFRONT_VIEWER_HEADER=true
  process.env.TRUST_CLOUDFRONT_VIEWER_HEADER = 'true';
  let ctx = createCtx({ 'cloudfront-viewer-address': '203.0.113.1:12345' });
  assert.strictEqual(getClientIp(ctx), '203.0.113.1');
  
  process.env.TRUST_CLOUDFRONT_VIEWER_HEADER = 'false';
  
  // 2. Default TRUSTED_PROXY_COUNT = 1
  process.env.TRUSTED_PROXY_COUNT = '1';
  ctx = createCtx({ 'x-forwarded-for': 'spoofed.ip, 198.51.100.1' });
  // length = 2. 2 - 1 = index 1 -> 198.51.100.1
  assert.strictEqual(getClientIp(ctx), '198.51.100.1');

  // 3. TRUSTED_PROXY_COUNT = 2
  process.env.TRUSTED_PROXY_COUNT = '2';
  ctx = createCtx({ 'x-forwarded-for': 'spoofed.ip, 198.51.100.1, 203.0.113.1' });
  // length = 3. 3 - 2 = index 1 -> 198.51.100.1
  assert.strictEqual(getClientIp(ctx), '198.51.100.1');

  console.log('getClientIp tests passed! Spoofed leftmost entry is ignored.');
}

runTests();
