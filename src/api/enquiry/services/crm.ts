import { mapEnquiryToCrm, type EnquiryForCrm } from '../utils/crmMapper';

interface CrmConfig {
  baseUrl: string;
  token: string;
  timeout: number;
}

export interface CrmSyncResult {
  leadId?: string;
  response: unknown;
}

export interface QuickUpdatePayload {
  leadStatus?: string;
  losingReason?: string;
  uniqCustId?: string;
  newFollowUpDate?: string;
  followUpComments?: string;
}

export class CrmServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'CrmServiceError';
    this.cause = cause;
  }
}

const getLeadId = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;

  const body = payload as Record<string, unknown>;
  const data = body.data && typeof body.data === 'object'
    ? body.data as Record<string, unknown>
    : undefined;
  const value = body.leadId ?? body.id ?? data?.leadId ?? data?.id;

  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
};

const readResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
};

export const createCrmService = (config: CrmConfig) => {
  const getHeaders = () => ({
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });

  const getBaseUrl = () => {
    // If baseUrl contains /ChannelLead/Upsert or similar path, normalize to root domain
    const url = config.baseUrl.trim();
    if (url.includes('/ChannelLead')) {
      return url.split('/ChannelLead')[0];
    }
    return url.replace(/\/$/, '');
  };

  return {
    /**
     * 1. POST /ChannelLead/Upsert
     * Primary endpoint: Create or update a lead with full details
     */
    async syncEnquiry(enquiry: EnquiryForCrm): Promise<CrmSyncResult> {
      if (!config.baseUrl || !config.token) {
        throw new CrmServiceError('CRM integration is not configured. Token is missing.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        const targetUrl = `${getBaseUrl()}/ChannelLead/Upsert`;
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(mapEnquiryToCrm(enquiry)),
          signal: controller.signal,
        });

        const responseBody = await readResponse(response);

        if (!response.ok) {
          throw new CrmServiceError(`CRM responded with HTTP ${response.status}.`);
        }

        return { leadId: getLeadId(responseBody), response: responseBody };
      } catch (error) {
        if (error instanceof CrmServiceError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new CrmServiceError('CRM request timed out.', error);
        }
        throw new CrmServiceError('CRM request failed.', error);
      } finally {
        clearTimeout(timeoutId);
      }
    },

    /**
     * 2. GET /ChannelLead/Fetch/{leadId}
     * Fetch details of a specific lead by its ID
     */
    async fetchLead(leadId: string | number): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/Fetch/${leadId}`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: getHeaders(),
      });
      return readResponse(response);
    },

    /**
     * 3. GET /ChannelLead/List/{pageSize}/{pageNumber}
     * Retrieve a paginated list of leads
     */
    async listLeads(pageSize: number = 10, pageNumber: number = 1): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/List/${pageSize}/${pageNumber}`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: getHeaders(),
      });
      return readResponse(response);
    },

    /**
     * 4. GET /ChannelLead/FollowUpList/{channelId}
     * Get the follow-up list for a specific channel
     */
    async getFollowUpList(channelId: string | number): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/FollowUpList/${channelId}`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: getHeaders(),
      });
      return readResponse(response);
    },

    /**
     * 5. POST /ChannelLead/QuickUpdate/{leadId}
     * Quickly update a lead's status, losing reason, follow-up date, comments
     */
    async quickUpdateLead(leadId: string | number, payload: QuickUpdatePayload): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/QuickUpdate/${leadId}`;
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          leadStatus: payload.leadStatus ?? 'Open',
          losingReason: payload.losingReason ?? '',
          uniqCustId: payload.uniqCustId ?? '',
          newFollowUpDate: payload.newFollowUpDate ?? new Date().toISOString(),
          followUpComments: payload.followUpComments ?? '',
        }),
      });
      return readResponse(response);
    },
  };
};
