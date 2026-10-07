import { createCrmService, CrmServiceError } from '../../enquiry/services/crm';
import type { EnquiryForCrm } from '../../enquiry/utils/crmMapper';

interface CollectionConfig {
  uid: string;
  tableName: string;
  statusCol: string;
  attemptsCol: string;
  nextAttemptCol: string;
  lastAttemptCol: string;
  syncedAtCol: string;
  errorCol: string;
  leadIdCol: string;
  responseCol: string;
  requestCol: string;
  statusEnum: {
    pending: string;
    processing: string;
    sent: string;
    failed: string;
  };
}

const COLLECTIONS: Record<string, CollectionConfig> = {
  'api::contact-submission.contact-submission': {
    uid: 'api::contact-submission.contact-submission',
    tableName: 'contact_submissions',
    statusCol: 'crm_push_status',
    attemptsCol: 'crm_attempts',
    nextAttemptCol: 'crm_next_attempt_at',
    lastAttemptCol: 'crm_last_attempt_at',
    syncedAtCol: 'crm_synced_at',
    errorCol: 'crm_error',
    leadIdCol: 'crm_lead_id',
    responseCol: 'crm_response',
    requestCol: 'crm_request',
    statusEnum: {
      pending: 'Pending',
      processing: 'Processing',
      sent: 'Sent',
      failed: 'Failed',
    },
  },
  'api::gold-valuation-submission.gold-valuation-submission': {
    uid: 'api::gold-valuation-submission.gold-valuation-submission',
    tableName: 'gold_valuation_submissions',
    statusCol: 'crm_push_status',
    attemptsCol: 'crm_attempts',
    nextAttemptCol: 'crm_next_attempt_at',
    lastAttemptCol: 'crm_last_attempt_at',
    syncedAtCol: 'crm_synced_at',
    errorCol: 'crm_error',
    leadIdCol: 'crm_lead_id',
    responseCol: 'crm_response',
    requestCol: 'crm_request',
    statusEnum: {
      pending: 'Pending',
      processing: 'Processing',
      sent: 'Sent',
      failed: 'Failed',
    },
  },
  'api::mobile-van-submission.mobile-van-submission': {
    uid: 'api::mobile-van-submission.mobile-van-submission',
    tableName: 'mobile_van_submissions',
    statusCol: 'crm_push_status',
    attemptsCol: 'crm_attempts',
    nextAttemptCol: 'crm_next_attempt_at',
    lastAttemptCol: 'crm_last_attempt_at',
    syncedAtCol: 'crm_synced_at',
    errorCol: 'crm_error',
    leadIdCol: 'crm_lead_id',
    responseCol: 'crm_response',
    requestCol: 'crm_request',
    statusEnum: {
      pending: 'Pending',
      processing: 'Processing',
      sent: 'Sent',
      failed: 'Failed',
    },
  },
  'api::blog-enquiry.blog-enquiry': {
    uid: 'api::blog-enquiry.blog-enquiry',
    tableName: 'blog_enquiries',
    statusCol: 'crm_push_status',
    attemptsCol: 'crm_attempts',
    nextAttemptCol: 'crm_next_attempt_at',
    lastAttemptCol: 'crm_last_attempt_at',
    syncedAtCol: 'crm_synced_at',
    errorCol: 'crm_error',
    leadIdCol: 'crm_lead_id',
    responseCol: 'crm_response',
    requestCol: 'crm_request',
    statusEnum: {
      pending: 'Pending',
      processing: 'Processing',
      sent: 'Sent',
      failed: 'Failed',
    },
  },
  'api::enquiry.enquiry': {
    uid: 'api::enquiry.enquiry',
    tableName: 'enquiries',
    statusCol: 'crm_status',
    attemptsCol: 'sync_attempts',
    nextAttemptCol: 'crm_next_attempt_at',
    lastAttemptCol: 'crm_last_attempt_at',
    syncedAtCol: 'crm_synced_at',
    errorCol: 'crm_error',
    leadIdCol: 'crm_lead_id',
    responseCol: 'crm_response',
    requestCol: 'crm_request',
    statusEnum: {
      pending: 'PENDING',
      processing: 'PROCESSING',
      sent: 'SYNCED',
      failed: 'FAILED',
    },
  },
};

export function computeNextAttemptAt(attempts: number, now = new Date()): Date {
  const backoffMinutes = Math.min(Math.pow(2, attempts), 30);
  return new Date(now.getTime() + backoffMinutes * 60 * 1000);
}

export interface PushResult {
  success: boolean;
  isConnectionError: boolean;
  isRetryable: boolean;
  leadId?: string;
  error?: string;
}

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Push a single lead row to CRM and sync status across source row and all-lead mirror.
   */
  async pushOne(uid: string, documentId: string): Promise<PushResult> {
    const config = COLLECTIONS[uid];
    if (!config) {
      strapi.log.error(`[crm-sync] Unknown collection UID: ${uid}`);
      return { success: false, isConnectionError: false, isRetryable: false, error: `Unknown collection ${uid}` };
    }

    const crmConfig = strapi.config.get('crm') as {
      baseUrl: string;
      timeout: number;
    };

    const documents = strapi.documents(uid as any);
    const allLeadDocuments = strapi.documents('api::all-lead.all-lead');

    let row: any;
    try {
      row = await documents.findOne({ documentId });
    } catch (fetchErr) {
      strapi.log.error(`[crm-sync] Failed to load ${uid} document ${documentId}:`, fetchErr);
      return { success: false, isConnectionError: false, isRetryable: true, error: 'Failed to load document' };
    }

    if (!row) {
      strapi.log.error(`[crm-sync] Document not found for ${uid} / ${documentId}`);
      return { success: false, isConnectionError: false, isRetryable: false, error: 'Document not found' };
    }

    const crmRequest: EnquiryForCrm = row.crmRequest;
    if (!crmRequest || typeof crmRequest !== 'object') {
      const errMsg = `Missing crmRequest payload for ${uid} / ${documentId}`;
      strapi.log.error(`[crm-sync] ${errMsg}`);

      const nowIso = new Date().toISOString();
      const isEnquiry = uid === 'api::enquiry.enquiry';

      await documents.update({
        documentId,
        data: isEnquiry
          ? { crmStatus: 'FAILED', crmError: errMsg, crmLastAttemptAt: nowIso }
          : { crmPushStatus: 'Failed', crmError: errMsg, crmLastAttemptAt: nowIso },
      });

      if (row.allLeadDocumentId) {
        await allLeadDocuments.update({
          documentId: row.allLeadDocumentId,
          data: { crmPushStatus: 'Failed', crmError: errMsg },
        }).catch((e: unknown) => strapi.log.error(`[crm-sync] Failed to update mirror for ${documentId}:`, e));
      }

      return { success: false, isConnectionError: false, isRetryable: false, error: errMsg };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const isEnquiry = uid === 'api::enquiry.enquiry';
    const currentAttempts = (isEnquiry ? row.syncAttempts : row.crmAttempts) || 0;
    const maxAttempts = parseInt(process.env.CRM_MAX_ATTEMPTS || '60', 10);

    try {
      const crm = createCrmService(crmConfig);
      const syncResult = await crm.syncEnquiry(crmRequest);

      // Success
      await documents.update({
        documentId,
        data: isEnquiry
          ? {
              crmStatus: 'SYNCED',
              crmLeadId: syncResult.leadId,
              crmResponse: JSON.parse(JSON.stringify(syncResult.response)),
              crmSyncedAt: nowIso,
              lastSyncAt: nowIso,
              crmLastAttemptAt: nowIso,
              crmError: null,
            }
          : {
              crmPushStatus: 'Sent',
              crmLeadId: syncResult.leadId,
              crmResponse: JSON.parse(JSON.stringify(syncResult.response)),
              crmSyncedAt: nowIso,
              crmLastAttemptAt: nowIso,
              crmError: null,
            },
      });

      if (row.allLeadDocumentId) {
        await allLeadDocuments.update({
          documentId: row.allLeadDocumentId,
          data: {
            crmPushStatus: 'Sent',
            crmLeadId: syncResult.leadId,
            crmResponse: JSON.parse(JSON.stringify(syncResult.response)),
            crmSyncedAt: nowIso,
            crmError: null,
          },
        }).catch((e: unknown) => strapi.log.error(`[crm-sync] Failed to update mirror for ${documentId}:`, e));
      }

      return {
        success: true,
        isConnectionError: false,
        isRetryable: false,
        leadId: syncResult.leadId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown CRM error.';
      let isRetryable = true;
      let isConnectionError = false;

      if (err instanceof CrmServiceError) {
        isRetryable = err.retryable;
        isConnectionError =
          err.status === undefined ||
          err.status >= 500 ||
          message.includes('timed out') ||
          message.includes('ECONNREFUSED') ||
          message.includes('fetch failed');
      } else if (err instanceof Error) {
        isConnectionError = err.name === 'AbortError' || message.includes('timed out') || message.includes('fetch failed');
      }

      const nextAttempts = currentAttempts + 1;

      if (!isRetryable) {
        // Permanent 4xx failure
        strapi.log.error(`[crm-sync] Non-retryable failure for ${uid}/${documentId}: ${message}`);
        await documents.update({
          documentId,
          data: isEnquiry
            ? { crmStatus: 'FAILED', syncAttempts: nextAttempts, crmLastAttemptAt: nowIso, crmError: message }
            : { crmPushStatus: 'Failed', crmAttempts: nextAttempts, crmLastAttemptAt: nowIso, crmError: message },
        });

        if (row.allLeadDocumentId) {
          await allLeadDocuments.update({
            documentId: row.allLeadDocumentId,
            data: { crmPushStatus: 'Failed', crmAttempts: nextAttempts, crmError: message },
          }).catch((e: unknown) => strapi.log.error(`[crm-sync] Failed to update mirror for ${documentId}:`, e));
        }

        return { success: false, isConnectionError: false, isRetryable: false, error: message };
      }

      // Retryable failure: check max attempts
      if (nextAttempts >= maxAttempts) {
        const exhaustedMsg = `Max retry attempts (${maxAttempts}) exceeded. Last error: ${message}`;
        strapi.log.error(`[crm-sync] Retries exhausted for ${uid}/${documentId}: ${exhaustedMsg}`);

        await documents.update({
          documentId,
          data: isEnquiry
            ? { crmStatus: 'FAILED', syncAttempts: nextAttempts, crmLastAttemptAt: nowIso, crmError: exhaustedMsg }
            : { crmPushStatus: 'Failed', crmAttempts: nextAttempts, crmLastAttemptAt: nowIso, crmError: exhaustedMsg },
        });

        if (row.allLeadDocumentId) {
          await allLeadDocuments.update({
            documentId: row.allLeadDocumentId,
            data: { crmPushStatus: 'Failed', crmAttempts: nextAttempts, crmError: exhaustedMsg },
          }).catch((e: unknown) => strapi.log.error(`[crm-sync] Failed to update mirror for ${documentId}:`, e));
        }

        return { success: false, isConnectionError, isRetryable: false, error: exhaustedMsg };
      }

      // Schedule next backoff retry; keep status as Pending / PENDING
      const nextAttemptAt = computeNextAttemptAt(nextAttempts, now);
      await documents.update({
        documentId,
        data: isEnquiry
          ? {
              crmStatus: 'PENDING',
              syncAttempts: nextAttempts,
              crmNextAttemptAt: nextAttemptAt.toISOString(),
              crmLastAttemptAt: nowIso,
              crmError: message,
            }
          : {
              crmPushStatus: 'Pending',
              crmAttempts: nextAttempts,
              crmNextAttemptAt: nextAttemptAt.toISOString(),
              crmLastAttemptAt: nowIso,
              crmError: message,
            },
      });

      if (row.allLeadDocumentId) {
        await allLeadDocuments.update({
          documentId: row.allLeadDocumentId,
          data: {
            crmPushStatus: 'Pending',
            crmAttempts: nextAttempts,
            crmError: message,
          },
        }).catch((e: unknown) => strapi.log.error(`[crm-sync] Failed to update mirror for ${documentId}:`, e));
      }

      return { success: false, isConnectionError, isRetryable: true, error: message };
    }
  },

  /**
   * Process pending retry queue: reclaim stale locks, atomically claim eligible rows, push to CRM with backoff.
   */
  async processPending(): Promise<void> {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const batchLimit = parseInt(process.env.CRM_RETRY_BATCH || '25', 10);

    // 1. Reclaim stale locks (Processing older than 10 mins)
    for (const conf of Object.values(COLLECTIONS)) {
      try {
        await strapi.db.connection(conf.tableName)
          .where(conf.statusCol, conf.statusEnum.processing)
          .andWhere((builder: any) => {
            builder.whereNull(conf.lastAttemptCol).orWhere(conf.lastAttemptCol, '<', tenMinutesAgo);
          })
          .update({
            [conf.statusCol]: conf.statusEnum.pending,
          });
      } catch (err) {
        strapi.log.error(`[crm-sync] Failed to reclaim stale locks for ${conf.tableName}:`, err);
      }
    }

    // 2. Select eligible batch across all 5 tables
    interface PendingCandidate {
      uid: string;
      id: number;
      documentId: string;
      createdAt: string | null;
    }

    const candidates: PendingCandidate[] = [];

    for (const conf of Object.values(COLLECTIONS)) {
      try {
        const rows = await strapi.db.connection(conf.tableName)
          .select('id', 'document_id as documentId', 'created_at as createdAt')
          .where(conf.statusCol, conf.statusEnum.pending)
          .andWhere((builder: any) => {
            builder.whereNull(conf.nextAttemptCol).orWhere(conf.nextAttemptCol, '<=', now);
          })
          .orderBy('id', 'asc')
          .limit(batchLimit);

        for (const r of rows) {
          candidates.push({
            uid: conf.uid,
            id: r.id,
            documentId: r.documentId,
            createdAt: r.createdAt,
          });
        }
      } catch (err) {
        strapi.log.error(`[crm-sync] Failed to select pending rows for ${conf.tableName}:`, err);
      }
    }

    candidates.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    const batch = candidates.slice(0, batchLimit);

    let pickedCount = 0;
    let sentCount = 0;
    let retryLaterCount = 0;
    let failedCount = 0;
    let breakerOn = false;

    // 3. Process each candidate sequentially with atomic lock
    for (const item of batch) {
      const conf = COLLECTIONS[item.uid];
      if (!conf) continue;

      try {
        const affected = await strapi.db.connection(conf.tableName)
          .where('id', item.id)
          .where(conf.statusCol, conf.statusEnum.pending)
          .update({
            [conf.statusCol]: conf.statusEnum.processing,
            [conf.lastAttemptCol]: new Date(),
          });

        if (affected !== 1) {
          continue; // Claimed by another instance
        }

        pickedCount++;

        const result = await this.pushOne(item.uid, item.documentId);

        if (result.success) {
          sentCount++;
        } else if (result.isRetryable) {
          retryLaterCount++;
        } else {
          failedCount++;
        }

        if (result.isConnectionError) {
          breakerOn = true;
          strapi.log.warn(`[crm-sync] Circuit breaker tripped by connection error on ${item.uid}/${item.documentId}. Stopping batch.`);
          break;
        }

        // Throttle 300ms between pushes
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (itemErr) {
        strapi.log.error(`[crm-sync] Error processing item ${item.uid}/${item.documentId}:`, itemErr);
      }
    }

    strapi.log.info(
      `[crm-retry] picked ${pickedCount}, sent ${sentCount}, retry-later ${retryLaterCount}, failed ${failedCount}, breaker=${breakerOn ? 'on' : 'off'}`
    );
  },
});
