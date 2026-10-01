import type { Context } from 'koa';

export const getClientIp = (ctx: Context): string => {
  if (process.env.TRUST_CLOUDFRONT_VIEWER_HEADER === 'true') {
    const cfHeader = ctx.request.headers['cloudfront-viewer-address'];
    if (cfHeader && typeof cfHeader === 'string') {
      const ip = cfHeader.split(':')[0];
      if (ip) return ip.trim();
    }
  }

  const trustedProxyCount = parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10);
  const forwarded = ctx.request.headers['x-forwarded-for'];
  let forwardedArray: string[] = [];
  
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    forwardedArray = forwarded.split(',').map(s => s.trim());
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    forwardedArray = forwarded[0].split(',').map(s => s.trim());
  }

  if (forwardedArray.length > 0) {
    const index = forwardedArray.length - trustedProxyCount;
    if (index >= 0 && index < forwardedArray.length) {
      return forwardedArray[index];
    }
  }

  // Fallback to socket address
  return ctx.req?.socket?.remoteAddress || ctx.request?.ip || 'unknown';
};
