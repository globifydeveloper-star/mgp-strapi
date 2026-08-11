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

let cachedCrmToken: { token: string; expiresAt: number } | null = null;

async function resolveCrmToken(staticToken?: string, _baseUrl?: string): Promise<string | null> {
  if (staticToken && staticToken.trim()) {
    return staticToken.trim();
  }

  const envToken = process.env.CRM_TOKEN || process.env.CHANNEL_LEAD_TOKEN;
  if (envToken && envToken.trim()) {
    return envToken.trim();
  }

  if (cachedCrmToken && Date.now() < cachedCrmToken.expiresAt) {
    return cachedCrmToken.token;
  }

  const u = process.env.CRM_USERNAME || process.env.CHANNEL_LEAD_USERNAME || process.env.BRANCH_MASTER_USERNAME;
  const p = process.env.CRM_PASSWORD || process.env.CHANNEL_LEAD_PASSWORD || process.env.BRANCH_MASTER_PASSWORD;

  if (!u || !p) {
    return null;
  }

  try {
    const authUrl = process.env.CRM_AUTH_URL;
    if (!authUrl) {
      console.error('[mgp-strapi] CRM_AUTH_URL environment variable is missing.');
      return null;
    }
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const token = data?.respData?.accessToken || data?.token || data?.access_token || data?.respData?.token || data?.respData?.access_token;
    if (token) {
      cachedCrmToken = { token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
      return token;
    }
    return null;
  } catch (e) {
    console.error('[mgp-strapi] CRM Auth/Login error:', e);
    return null;
  }
}

const getLeadId = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;

  const body = payload as Record<string, unknown>;
  const data = body.data && typeof body.data === 'object'
    ? body.data as Record<string, unknown>
    : undefined;
  const respData = body.respData && typeof body.respData === 'object'
    ? body.respData as Record<string, unknown>
    : undefined;
  const value = body.leadId ?? body.id ?? data?.leadId ?? data?.id ?? respData?.leadId ?? respData?.id;

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
  const getHeaders = async () => {
    const token = await resolveCrmToken(config.token, config.baseUrl);
    return {
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  };

  const getBaseUrl = () => {
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
      if (!config.baseUrl) {
        throw new CrmServiceError('CRM integration is not configured. Base URL is missing.');
      }

      const headers = await getHeaders();
      if (!headers.Authorization || headers.Authorization === 'Bearer ') {
        throw new CrmServiceError('CRM integration is not configured. Token or login credentials missing.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        const targetUrl = `${getBaseUrl()}/ChannelLead/Upsert`;
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers,
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
     */
    async fetchLead(leadId: string | number): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/Fetch/${leadId}`;
      const headers = await getHeaders();
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });
      return readResponse(response);
    },

    /**
     * 3. GET /ChannelLead/List/{pageSize}/{pageNumber}
     */
    async listLeads(pageSize: number = 10, pageNumber: number = 1): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/List/${pageSize}/${pageNumber}`;
      const headers = await getHeaders();
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });
      return readResponse(response);
    },

    /**
     * 4. GET /ChannelLead/FollowUpList/{channelId}
     */
    async getFollowUpList(channelId: string | number): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/FollowUpList/${channelId}`;
      const headers = await getHeaders();
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });
      return readResponse(response);
    },

    /**
     * 5. POST /ChannelLead/QuickUpdate/{leadId}
     */
    async quickUpdateLead(leadId: string | number, payload: QuickUpdatePayload): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/QuickUpdate/${leadId}`;
      const headers = await getHeaders();
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
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
