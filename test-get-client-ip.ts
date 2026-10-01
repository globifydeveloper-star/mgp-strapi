import { getClientIp } from './src/utils/get-client-ip';

function mockGetClientIp(headers: any, trustedCount: number, trustCloudfront: string = 'false') {
  process.env.TRUSTED_PROXY_COUNT = trustedCount.toString();
  process.env.TRUST_CLOUDFRONT_VIEWER_HEADER = trustCloudfront;

  const ctx: any = {
    request: {
      headers,
      ip: '10.0.0.1'
    },
    req: { socket: { remoteAddress: '10.0.0.1' } }
  };

  return getClientIp(ctx);
}

const assert = require('assert');

try {
  const ip1 = mockGetClientIp({ 'x-forwarded-for': '1.2.3.4, 203.0.113.1' }, 1);
  assert.strictEqual(ip1, '203.0.113.1', 'Failed Test 1: ' + ip1);

  const ip2 = mockGetClientIp({ 'x-forwarded-for': '1.2.3.4, 203.0.113.1' }, 2);
  assert.strictEqual(ip2, '1.2.3.4', 'Failed Test 2: ' + ip2);
  
  const ip3 = mockGetClientIp({ 'cloudfront-viewer-address': '198.51.100.1:443' }, 1, 'true');
  assert.strictEqual(ip3, '198.51.100.1', 'Failed Test 3: ' + ip3);

  console.log('All tests passed successfully!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
