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

export const createCrmService = (config: CrmConfig) => ({
  async syncEnquiry(enquiry: EnquiryForCrm): Promise<CrmSyncResult> {
    if (!config.baseUrl || !config.token) {
      throw new CrmServiceError('CRM integration is not configured.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(
        `${config.baseUrl.replace(/\/$/, '')}/ChannelLead/Upsert`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(mapEnquiryToCrm(enquiry)),
          signal: controller.signal,
        }
      );
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
});
