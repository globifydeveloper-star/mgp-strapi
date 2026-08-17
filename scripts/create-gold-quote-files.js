const fs = require('fs');
const path = require('path');

const serviceCode = `import { resolveAuthToken, loginChannelLead, invalidateAuthToken } from './authService';

export const GOLD_QUOTE_BASE_URL = (
  process.env.GOLD_QUOTE_BASE_URL ||
  'https://mgpmgpext-mgpuat.muthootexim.com'
).replace(/\\/$/, '');

export interface GoldQuoteRequest {
  weightInGms: number;
  purityPerc: number;
}

export interface GoldQuoteData {
  purchasePrice: number;
  preGstAmount: number;
  gstAmount: number;
  totalQuoteAmt: number;
}

export interface GoldQuoteResponse {
  success: boolean;
  message?: string;
  errorCode?: string | number | null;
  respData?: GoldQuoteData;
  fromCache?: boolean;
}

// In-memory 20-second TTL Cache
interface CacheEntry {
  data: GoldQuoteResponse;
  expiresAt: number;
}

const CACHE_TTL_MS = 20 * 1000; // 20 seconds
const quoteCache = new Map<string, CacheEntry>();

export function clearQuoteCache(): void {
  quoteCache.clear();
}

// In-memory Rate Limiter: max 1 request per 2 seconds per client IP
const RATE_LIMIT_WINDOW_MS = 2000; // 2 seconds
const clientRequestTimes = new Map<string, number>();

export function checkRateLimit(clientIp: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const lastRequestTime = clientRequestTimes.get(clientIp);

  if (lastRequestTime && now - lastRequestTime < RATE_LIMIT_WINDOW_MS) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastRequestTime)) / 1000);
    return { allowed: false, retryAfter };
  }

  clientRequestTimes.set(clientIp, now);

  // Periodically clean up old IP entries
  if (clientRequestTimes.size > 200) {
    for (const [ip, time] of clientRequestTimes.entries()) {
      if (now - time > RATE_LIMIT_WINDOW_MS * 5) {
        clientRequestTimes.delete(ip);
      }
    }
  }

  return { allowed: true };
}

/**
 * Fetch live gold quote from Muthoot Exim ChannelQuickQuote API.
 * Server-side only. Uses bearer token from authService with auto-refresh on 401.
 */
export async function fetchGoldQuote({
  weightInGms,
  purityPerc,
}: GoldQuoteRequest): Promise<GoldQuoteResponse> {
  const weight = Number(weightInGms);
  const purity = Number(purityPerc);

  if (!Number.isFinite(weight) || weight <= 0) {
    return {
      success: false,
      message: 'Invalid weight. Weight must be a positive number.',
    };
  }

  if (!Number.isFinite(purity) || purity <= 0 || purity > 100) {
    return {
      success: false,
      message: 'Invalid purity. Purity must be a percentage between 0 and 100.',
    };
  }

  const cacheKey = \`\${weight}_\${purity}\`;
  const cached = quoteCache.get(cacheKey);
  const now = Date.now();

  if (cached && now < cached.expiresAt) {
    return {
      ...cached.data,
      fromCache: true,
    };
  }

  let token = await resolveAuthToken();

  const callUpstream = async (authToken: string | null): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = authToken.startsWith('Bearer ')
        ? authToken
        : \`Bearer \${authToken}\`;
    }

    try {
      const response = await fetch(\`\${GOLD_QUOTE_BASE_URL}/ChannelQuickQuote/ChannelGetQuote\`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          weightInGms: weight,
          purityPerc: purity,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    let res = await callUpstream(token);

    // On 401 Unauthorized, invalidate token, fetch fresh token, and retry once
    if (res.status === 401) {
      console.warn('[GoldQuote] Received 401 Unauthorized. Invalidating token and retrying...');
      invalidateAuthToken();
      token = await loginChannelLead();
      if (token) {
        res = await callUpstream(token);
      }
    }

    if (!res.ok) {
      console.error(\`[GoldQuote] Upstream HTTP error: \${res.status} \${res.statusText}\`);
      return {
        success: false,
        message: 'Rate temporarily unavailable — please try again',
      };
    }

    const data: GoldQuoteResponse = await res.json();

    if (data.success && data.respData) {
      // Store in memory cache
      quoteCache.set(cacheKey, {
        data: {
          success: true,
          message: data.message || '',
          errorCode: data.errorCode || null,
          respData: {
            purchasePrice: Number(data.respData.purchasePrice) || 0,
            preGstAmount: Number(data.respData.preGstAmount) || 0,
            gstAmount: Number(data.respData.gstAmount) || 0,
            totalQuoteAmt: Number(data.respData.totalQuoteAmt) || 0,
          },
        },
        expiresAt: now + CACHE_TTL_MS,
      });

      return {
        success: true,
        message: data.message || '',
        errorCode: data.errorCode || null,
        respData: data.respData,
        fromCache: false,
      };
    }

    console.warn('[GoldQuote] Upstream returned non-success response:', data.message || data.errorCode);
    return {
      success: false,
      message: data.message || 'Rate temporarily unavailable — please try again',
      errorCode: data.errorCode,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error('[GoldQuote] Upstream request timed out (10s)');
    } else {
      console.error('[GoldQuote] Fetch error:', err?.message || err);
    }
    return {
      success: false,
      message: 'Rate temporarily unavailable — please try again',
    };
  }
}
`;

const routeCode = `import { NextRequest, NextResponse } from 'next/server';
import { fetchGoldQuote, checkRateLimit } from '@/lib/goldQuoteService';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting by real client IP (x-forwarded-for for Render / reverse proxy)
    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many requests. Please wait a moment before trying again.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 2),
          },
        }
      );
    }

    // 2. Parse and Validate Request Body
    const body = await request.json().catch(() => ({}));
    const { weightInGms, purityPerc } = body;

    const weight = Number(weightInGms);
    const purity = Number(purityPerc);

    if (!Number.isFinite(weight) || weight <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid weightInGms. Must be a positive number.',
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(purity) || purity <= 0 || purity > 100) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid purityPerc. Must be a number between 0 and 100.',
        },
        { status: 400 }
      );
    }

    // 3. Call Server-Side Service with Caching and Token Auth
    const result = await fetchGoldQuote({ weightInGms: weight, purityPerc: purity });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'Rate temporarily unavailable — please try again',
          errorCode: result.errorCode,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        respData: result.respData,
        message: result.message || '',
        fromCache: result.fromCache,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API/GoldQuote Route Error]:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        message: 'Rate temporarily unavailable — please try again',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weightInGms = searchParams.get('weightInGms') || '1';
    const purityPerc = searchParams.get('purityPerc') || '99';

    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many requests. Please wait a moment before trying again.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 2),
          },
        }
      );
    }

    const weight = Number(weightInGms);
    const purity = Number(purityPerc);

    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(purity) || purity <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid weight or purity parameter.' },
        { status: 400 }
      );
    }

    const result = await fetchGoldQuote({ weightInGms: weight, purityPerc: purity });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('[API/GoldQuote GET Route Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Rate temporarily unavailable — please try again' },
      { status: 500 }
    );
  }
}
`;

const webSrcDir = 'd:/MGP/MGP-WEB/src';
fs.writeFileSync(path.join(webSrcDir, 'lib/goldQuoteService.ts'), serviceCode, 'utf8');
console.log('Written src/lib/goldQuoteService.ts');

const apiDir = path.join(webSrcDir, 'app/api/gold-quote');
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}
fs.writeFileSync(path.join(apiDir, 'route.ts'), routeCode, 'utf8');
console.log('Written src/app/api/gold-quote/route.ts');
