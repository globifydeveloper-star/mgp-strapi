/**
 * scripts/crm-backfill-failed.js
 *
 * Backfill script for existing Failed CRM rows.
 * Rebuilds missing crmRequest snapshots (matching with all_leads for branchCode if needed)
 * and resets status to Pending so they can be processed cleanly by the retry queue.
 *
 * SAFETY FIRST:
 * - Runs in DRY-RUN mode by default.
 * - Pass --apply to actually commit changes to the database.
 *
 * Usage:
 *   node scripts/crm-backfill-failed.js            # Dry run (inspect & report only)
 *   node scripts/crm-backfill-failed.js --apply    # Execute backfill updates
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Parse .env if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const isApply = process.argv.includes('--apply');

async function getDbConnection() {
  const host = process.env.DATABASE_HOST || '127.0.0.1';
  const port = parseInt(process.env.DATABASE_PORT || '3306', 10);
  const database = process.env.DATABASE_NAME || 'defaultdb';
  const user = process.env.DATABASE_USERNAME || 'root';
  const password = process.env.DATABASE_PASSWORD || '';

  console.log(`[crm-backfill] Connecting to DB ${user}@${host}:${port}/${database}`);

  return mysql.createConnection({
    host,
    port,
    database,
    user,
    password,
    ssl: process.env.DATABASE_SSL === 'true' || host.includes('aivencloud') ? { rejectUnauthorized: false } : undefined,
  });
}

function parseJson(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`=======================================================`);
  console.log(` CRM Retry Backfill Tool`);
  console.log(` Mode: ${isApply ? '*** LIVE APPLY ***' : 'DRY-RUN (no changes will be written)'}`);
  console.log(`=======================================================\n`);

  const connection = await getDbConnection();

  try {
    // 1. Fetch all_leads for matching
    const [allLeads] = await connection.query(`
      SELECT id, document_id, name, phone, branch, branch_code, submitted_at, crm_push_status
      FROM all_leads
    `);

    function findMatchingAllLead(phone, submittedAt) {
      if (!phone) return null;
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const subTime = submittedAt ? new Date(submittedAt).getTime() : 0;

      return allLeads.find((al) => {
        const alPhone = String(al.phone || '').replace(/\D/g, '').slice(-10);
        if (alPhone !== cleanPhone) return false;
        if (!subTime || !al.submitted_at) return true;
        const alTime = new Date(al.submitted_at).getTime();
        return Math.abs(alTime - subTime) <= 10000; // within 10s
      });
    }

    const TABLES = [
      {
        name: 'contact_submissions',
        statusCol: 'crm_push_status',
        failedVal: 'Failed',
        leadSource: 'CONTACT_US',
        phoneCol: 'phone',
        enquiryType: 'Contact Us',
      },
      {
        name: 'gold_valuation_submissions',
        statusCol: 'crm_push_status',
        failedVal: 'Failed',
        leadSource: 'HOME_PAGE',
        phoneCol: 'phone',
        enquiryType: 'Gold Valuation',
      },
      {
        name: 'mobile_van_submissions',
        statusCol: 'crm_push_status',
        failedVal: 'Failed',
        leadSource: 'HOME_PAGE',
        phoneCol: 'phone',
        enquiryType: 'Mobile Van',
      },
      {
        name: 'blog_enquiries',
        statusCol: 'crm_push_status',
        failedVal: 'Failed',
        leadSource: 'BLOG',
        phoneCol: 'mobile',
        enquiryType: 'Blog Enquiry',
      },
      {
        name: 'enquiries',
        statusCol: 'crm_status',
        failedVal: 'FAILED',
        leadSource: 'HOME_PAGE',
        phoneCol: 'mobile',
        enquiryType: 'Enquiry',
      },
    ];

    let totalFailed = 0;
    let totalPrepared = 0;

    for (const t of TABLES) {
      console.log(`\nChecking table: ${t.name}...`);
      const [rows] = await connection.query(
        `SELECT * FROM ${t.name} WHERE ${t.statusCol} = ?`,
        [t.failedVal]
      );

      console.log(`  Found ${rows.length} failed rows.`);
      totalFailed += rows.length;

      for (const row of rows) {
        const phone = row[t.phoneCol];
        const submittedAt = row.submitted_at || row.created_at;
        const matchingLead = findMatchingAllLead(phone, submittedAt);
        const branchCode = row.branch_code || matchingLead?.branch_code || '';
        const branchName = row.branch || matchingLead?.branch || '';

        let existingReq = parseJson(row.crm_request);
        let rebuiltReq = existingReq;

        if (!rebuiltReq) {
          rebuiltReq = {
            name: row.name || 'Unknown',
            mobile: phone || '',
            email: row.email || undefined,
            leadSource: row.source || t.leadSource,
            branchCode: branchCode,
            remarks: `Source: ${t.enquiryType} | Branch: ${branchName} | Code: ${branchCode}${row.message ? ` | Msg: ${row.message}` : ''}`,
          };
        } else if (!rebuiltReq.branchCode && branchCode) {
          rebuiltReq.branchCode = branchCode;
        }

        console.log(`  - Row ID ${row.id} (${row.document_id || 'no doc_id'}):`);
        console.log(`    Phone: ${phone} | BranchCode: ${branchCode || '(NONE)'} | Matched AllLead: ${matchingLead ? matchingLead.document_id : 'NO'}`);
        console.log(`    Last CRM Error: ${row.crm_error || 'N/A'}`);

        totalPrepared++;

        if (isApply) {
          const isEnquiry = t.name === 'enquiries';
          if (isEnquiry) {
            await connection.query(
              `UPDATE ${t.name}
               SET crm_status = 'PENDING',
                   sync_attempts = 0,
                   crm_next_attempt_at = NULL,
                   crm_error = NULL,
                   crm_request = ?,
                   all_lead_document_id = COALESCE(all_lead_document_id, ?)
               WHERE id = ?`,
              [JSON.stringify(rebuiltReq), matchingLead?.document_id || null, row.id]
            );
          } else {
            await connection.query(
              `UPDATE ${t.name}
               SET crm_push_status = 'Pending',
                   crm_attempts = 0,
                   crm_next_attempt_at = NULL,
                   crm_error = NULL,
                   crm_request = ?,
                   all_lead_document_id = COALESCE(all_lead_document_id, ?)
               WHERE id = ?`,
              [JSON.stringify(rebuiltReq), matchingLead?.document_id || null, row.id]
            );
          }

          if (matchingLead) {
            await connection.query(
              `UPDATE all_leads
               SET crm_push_status = 'Pending',
                   crm_attempts = 0,
                   crm_error = NULL
               WHERE id = ?`,
              [matchingLead.id]
            );
          }
        }
      }
    }

    console.log(`\n-------------------------------------------------------`);
    console.log(`Summary:`);
    console.log(`  Total Failed rows discovered: ${totalFailed}`);
    console.log(`  Total rows evaluated: ${totalPrepared}`);
    if (isApply) {
      console.log(`  [APPLIED] Successfully reset ${totalPrepared} rows to Pending with crmRequest.`);
    } else {
      console.log(`  [DRY RUN] No database records were modified.`);
      console.log(`  Run with --apply to commit these backfill updates.`);
    }
    console.log(`-------------------------------------------------------\n`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[crm-backfill] Fatal error:', err);
  process.exit(1);
});
