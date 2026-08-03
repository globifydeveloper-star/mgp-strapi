const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '@Sulaiman5201',
    database: 'strapi_db'
  });

  try {
    // Find duplicate permission->role links and remove them (keep only the first/min id)
    const [dupes] = await connection.query(`
      SELECT permission_id, role_id, COUNT(*) as cnt, MIN(id) as keep_id
      FROM up_permissions_role_lnk
      GROUP BY permission_id, role_id
      HAVING cnt > 1
    `);

    console.log("Duplicate links found:", dupes.length);
    for (const dupe of dupes) {
      const deleted = await connection.query(`
        DELETE FROM up_permissions_role_lnk
        WHERE permission_id = ? AND role_id = ? AND id != ?
      `, [dupe.permission_id, dupe.role_id, dupe.keep_id]);
      console.log(`Cleaned up permission_id=${dupe.permission_id} role_id=${dupe.role_id}, deleted ${deleted[0].affectedRows} duplicates`);
    }

    // Also find duplicate permission actions and remove dupes (keep first)
    const [permDupes] = await connection.query(`
      SELECT action, COUNT(*) as cnt, MIN(id) as keep_id
      FROM up_permissions
      GROUP BY action
      HAVING cnt > 1
    `);
    console.log("Duplicate permission actions found:", permDupes.length);
    for (const dupe of permDupes) {
      // First re-link any orphaned links to the kept permission
      const [ids] = await connection.query(`SELECT id FROM up_permissions WHERE action = ? AND id != ?`, [dupe.action, dupe.keep_id]);
      for (const row of ids) {
        await connection.query(`DELETE FROM up_permissions_role_lnk WHERE permission_id = ?`, [row.id]);
        await connection.query(`DELETE FROM up_permissions WHERE id = ?`, [row.id]);
      }
      console.log(`Cleaned up duplicate action: ${dupe.action}`);
    }

    // Final verification
    const [finalPerms] = await connection.query(`
      SELECT p.action FROM up_permissions p
      JOIN up_permissions_role_lnk l ON l.permission_id = p.id
      WHERE l.role_id = 4
      ORDER BY p.action
    `);
    console.log("\nFinal public permissions count:", finalPerms.length);
    console.log("Final public permissions:", finalPerms.map(p => p.action));
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    await connection.end();
  }
}

main();
