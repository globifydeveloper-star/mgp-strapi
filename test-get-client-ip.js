const assert = require('assert');

// A simple mock for Strapi's Context
function mockGetClientIp(headers, trustedCount, trustCloudfront = 'false') {
  process.env.TRUSTED_PROXY_COUNT = trustedCount.toString();
  process.env.TRUST_CLOUDFRONT_VIEWER_HEADER = trustCloudfront;

  const ctx = {
    request: {
      headers,
      ip: '10.0.0.1'
    },
    req: { socket: { remoteAddress: '10.0.0.1' } }
  };

  const getClientIp = require('./src/utils/get-client-ip').getClientIp;
  return getClientIp(ctx);
}

try {
  // Test 1: X-Forwarded-For: 1.2.3.4, <real-ish ip> with TRUSTED_PROXY_COUNT=1
  // Expected to return <real-ish ip>
  const ip1 = mockGetClientIp({ 'x-forwarded-for': '1.2.3.4, 203.0.113.1' }, 1);
  assert.strictEqual(ip1, '203.0.113.1', 'Failed Test 1');

  // Test 2: TRUSTED_PROXY_COUNT=2
  // Expected to return 1.2.3.4
  const ip2 = mockGetClientIp({ 'x-forwarded-for': '1.2.3.4, 203.0.113.1' }, 2);
  assert.strictEqual(ip2, '1.2.3.4', 'Failed Test 2');
  
  // Test 3: Cloudfront
  const ip3 = mockGetClientIp({ 'cloudfront-viewer-address': '198.51.100.1:443' }, 1, 'true');
  assert.strictEqual(ip3, '198.51.100.1', 'Failed Test 3');

  console.log('All tests passed successfully!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
