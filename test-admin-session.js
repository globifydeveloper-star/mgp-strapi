const { verifyAdminSession } = require('./build/src/utils/verify-admin-session.js'); // Assuming it's compiled to CJS
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Database = require('better-sqlite3');

async function runTests() {
  const db = new Database('.tmp/data.db');
  
  // Create a mock strapi object
  const mockStrapi = {
    config: {
      get: (key) => {
        if (key === 'admin.auth.secret') return 'test-secret';
        return null;
      }
    },
    log: {
      info: console.log,
      warn: console.warn,
      error: console.error
    },
    db: {
      connection: (table) => {
        return {
          where: (col, val) => {
            let user = null;
            if (table === 'admin_users') {
              if (val === 1) user = { id: 1, is_active: 1, blocked: 0 };
              if (val === 2) user = { id: 2, is_active: 0, blocked: 0 }; // inactive
              if (val === 3) user = { id: 3, is_active: 1, blocked: 1 }; // blocked
            }
            if (table === 'admin_users_roles_lnk') {
              return {
                join: () => ({
                  where: () => ({
                    select: () => {
                      if (val === 1) return [{ code: 'strapi-super-admin' }];
                      if (val === 4) return [{ code: 'strapi-author' }]; // invalid role
                      return [];
                    }
                  })
                })
              }
            }
            return {
              first: () => user
            };
          }
        }
      }
    }
  };

  // 1. No token -> 401 (false)
  const ctxNoToken = { headers: {}, query: {} };
  const res1 = await verifyAdminSession(ctxNoToken, mockStrapi);
  console.log('No token ->', res1 === false ? 'PASS' : 'FAIL');

  // 2. API token -> 401 (false)
  const ctxApiToken = { headers: { authorization: 'Bearer some-api-token' }, query: {} };
  const res2 = await verifyAdminSession(ctxApiToken, mockStrapi);
  console.log('API token (invalid JWT) ->', res2 === false ? 'PASS' : 'FAIL');

  // 3. Expired admin JWT -> 401 (false)
  const expiredToken = jwt.sign({ id: 1 }, 'test-secret', { expiresIn: '-1h' });
  const ctxExpired = { headers: { authorization: `Bearer ${expiredToken}` }, query: {} };
  const res3 = await verifyAdminSession(ctxExpired, mockStrapi);
  console.log('Expired token ->', res3 === false ? 'PASS' : 'FAIL');

  // 4. Inactive admin -> 403 (false, but mapped to 401/403 in controller)
  const inactiveToken = jwt.sign({ id: 2 }, 'test-secret');
  const ctxInactive = { headers: { authorization: `Bearer ${inactiveToken}` }, query: {} };
  const res4 = await verifyAdminSession(ctxInactive, mockStrapi);
  console.log('Inactive admin ->', res4 === false ? 'PASS' : 'FAIL');

  // 5. Allowed admin -> works
  const allowedToken = jwt.sign({ id: 1 }, 'test-secret');
  const ctxAllowed = { headers: { authorization: `Bearer ${allowedToken}` }, query: {}, path: '/api/export' };
  const res5 = await verifyAdminSession(ctxAllowed, mockStrapi);
  console.log('Allowed admin ->', res5 === true ? 'PASS' : 'FAIL');

  // 6. Admin without allowed role -> false
  const noRoleToken = jwt.sign({ id: 4 }, 'test-secret');
  const ctxNoRole = { headers: { authorization: `Bearer ${noRoleToken}` }, query: {} };
  // Mock db doesn't have user 4, so it returns null. Wait, let's say user 4 exists.
  mockStrapi.db.connection = (table) => {
    return {
      where: (col, val) => {
        if (table === 'admin_users' && val === 4) return { first: () => ({ id: 4, is_active: 1, blocked: 0 }) };
        if (table === 'admin_users_roles_lnk') return { join: () => ({ where: () => ({ select: () => [{ code: 'strapi-author' }] }) }) };
        return { first: () => null };
      }
    }
  };
  const res6 = await verifyAdminSession(ctxNoRole, mockStrapi);
  console.log('Admin without allowed role ->', res6 === false ? 'PASS' : 'FAIL');

}

runTests().catch(console.error);
