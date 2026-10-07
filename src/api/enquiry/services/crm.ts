import { mapEnquiryToCrm, type EnquiryForCrm } from '../utils/crmMapper';

interface CrmConfig {
  baseUrl: string;
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
  readonly status?: number;
  readonly retryable: boolean;
  readonly responseBody?: unknown;

  constructor(
    message: string,
    options?: { cause?: unknown; status?: number; retryable?: boolean; responseBody?: unknown }
  ) {
    super(message);
    this.name = 'CrmServiceError';
    this.cause = options?.cause;
    this.status = options?.status;
    this.retryable = options?.retryable ?? true;
    this.responseBody = options?.responseBody;
  }
}

let cachedCrmToken: { token: string; expiresAt: number } | null = null;

export function clearCrmTokenCache(): void {
  cachedCrmToken = null;
}

async function resolveCrmToken(): Promise<string | null> {
  if (cachedCrmToken && Date.now() < cachedCrmToken.expiresAt) {
    return cachedCrmToken.token;
  }

  const u = process.env.CRM_USERNAME;
  const p = process.env.CRM_PASSWORD;

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
      // Token's actual JWT `exp` gives it a 12-hour lifetime; cache well under that
      // so a stale-but-cached token is never presented to the CRM API as valid.
      cachedCrmToken = { token, expiresAt: Date.now() + 10 * 60 * 60 * 1000 };
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
  const getBaseUrl = () => {
    const url = config.baseUrl.trim();
    if (url.includes('/ChannelLead')) {
      return url.split('/ChannelLead')[0];
    }
    return url.replace(/\/$/, '');
  };

  const executeWithAuthRetry = async (
    targetUrl: string,
    method: string,
    bodyPayload?: unknown,
    timeoutMs: number = config.timeout
  ): Promise<{ response: Response; body: unknown }> => {
    if (!config.baseUrl) {
      throw new CrmServiceError('CRM integration is not configured. Base URL is missing.', { retryable: true });
    }

    const token = await resolveCrmToken();
    if (!token) {
      throw new CrmServiceError('CRM integration is not configured. CRM_USERNAME or CRM_PASSWORD is missing or login failed.', { retryable: true });
    }

    const doFetch = async (authToken: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(targetUrl, {
          method,
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: bodyPayload !== undefined ? JSON.stringify(bodyPayload) : undefined,
          signal: controller.signal,
        });
        const body = await readResponse(response);
        return { response, body };
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      let result = await doFetch(token);

      if (result.response.status === 401) {
        // 401 received -> clear token cache and retry once with fresh token
        clearCrmTokenCache();
        const freshToken = await resolveCrmToken();
        if (freshToken) {
          result = await doFetch(freshToken);
        }
      }

      if (!result.response.ok) {
        const status = result.response.status;
        const isRetryable = status === 401 || status === 429 || status >= 500;
        const errorMsg = isRetryable
          ? `CRM responded with HTTP ${status}.`
          : `CRM rejected request with HTTP ${status}: ${typeof result.body === 'object' ? JSON.stringify(result.body) : String(result.body)}`;
        throw new CrmServiceError(errorMsg, {
          status,
          retryable: isRetryable,
          responseBody: result.body,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof CrmServiceError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CrmServiceError('CRM request timed out.', { cause: error, retryable: true });
      }
      throw new CrmServiceError('CRM request failed.', { cause: error, retryable: true });
    }
  };

  return {
    /**
     * 1. POST /ChannelLead/Upsert
     * Primary endpoint: Create or update a lead with full details
     */
    async syncEnquiry(enquiry: EnquiryForCrm): Promise<CrmSyncResult> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/Upsert`;
      const { body } = await executeWithAuthRetry(targetUrl, 'POST', mapEnquiryToCrm(enquiry));
      return { leadId: getLeadId(body), response: body };
    },

    /**
     * 2. GET /ChannelLead/Fetch/{leadId}
     */
    async fetchLead(leadId: string | number): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/Fetch/${leadId}`;
      const { body } = await executeWithAuthRetry(targetUrl, 'GET');
      return body;
    },

    /**
     * 3. GET /ChannelLead/List/{pageSize}/{pageNumber}
     */
    async listLeads(pageSize: number = 10, pageNumber: number = 1): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/List/${pageSize}/${pageNumber}`;
      const { body } = await executeWithAuthRetry(targetUrl, 'GET');
      return body;
    },

    /**
     * 4. GET /ChannelLead/FollowUpList/{channelId}
     */
    async getFollowUpList(channelId: string | number): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/FollowUpList/${channelId}`;
      const { body } = await executeWithAuthRetry(targetUrl, 'GET');
      return body;
    },

    /**
     * 5. POST /ChannelLead/QuickUpdate/{leadId}
     */
    async quickUpdateLead(leadId: string | number, payload: QuickUpdatePayload): Promise<unknown> {
      const targetUrl = `${getBaseUrl()}/ChannelLead/QuickUpdate/${leadId}`;
      const { body } = await executeWithAuthRetry(targetUrl, 'POST', {
        leadStatus: payload.leadStatus ?? 'Open',
        losingReason: payload.losingReason ?? '',
        uniqCustId: payload.uniqCustId ?? '',
        newFollowUpDate: payload.newFollowUpDate ?? new Date().toISOString(),
        followUpComments: payload.followUpComments ?? '',
      });
      return body;
    },
  };
};
