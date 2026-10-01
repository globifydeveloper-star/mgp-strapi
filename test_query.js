const db = require('better-sqlite3')('.tmp/data.db');
const rows = db.prepare("SELECT r.type AS role, p.action FROM up_permissions p JOIN up_permissions_role_lnk l ON l.permission_id = p.id JOIN up_roles r ON r.id = l.role_id WHERE r.type IN ('public','authenticated') ORDER BY r.type, p.action;").all();
console.table(rows);
