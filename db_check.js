const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '.tmp', 'data.db');
const db = new Database(dbPath);

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables:", tables.map(r => r.name));

  const info = db.prepare("PRAGMA table_info(up_permissions)").all();
  console.log("up_permissions columns:", info);

  const roles = db.prepare("SELECT * FROM up_roles").all();
  console.log("up_roles:", roles);
  
  // also check if there is an existing find permission for homepage
  const homepagePerms = db.prepare("SELECT * FROM up_permissions WHERE action LIKE '%homepage%'").all();
  console.log("Homepage Permissions:", homepagePerms);
} catch (err) {
  console.error(err);
}
