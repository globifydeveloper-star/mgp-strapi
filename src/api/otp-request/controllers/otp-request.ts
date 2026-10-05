import type { Context } from 'koa';
import { factories } from '@strapi/strapi';
import { createHmac, timingSafeEqual, randomInt } from 'crypto';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_24H = 10;
const PHONE_REGEX = /^\d{10}$/;

const generateOtpCode = (): string => randomInt(100000, 1000000).toString();

const hashOtp = (phone: string, code: string): string => {
  const salt = process.env.OTP_SALT;
  if (!salt) throw new Error('OTP_SALT is not configured.');
  return createHmac('sha256', salt).update(`${phone}:${code}`).digest('hex');
};

const hashIp = (ip: string): string => {
  const salt = process.env.OTP_SALT || process.env.INTERNAL_API_SECRET;
  if (!salt) throw new Error('OTP_SALT or INTERNAL_API_SECRET is not configured.');
  return createHmac('sha256', salt).update(ip).digest('hex');
};

const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

const maskPhone = (phone: string): string => {
  if (phone.length < 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
};

export default factories.createCoreController(
  'api::otp-request.otp-request',
  ({ strapi }) => ({
    async sendOtp(ctx: Context) {
      const secret = ctx.request.headers['x-internal-secret'];
      const expected = process.env.INTERNAL_API_SECRET;
      if (!expected || !secret || typeof secret !== 'string' || !safeCompare(secret, expected)) {
        ctx.status = 403;
        ctx.body = { success: false, message: 'Forbidden' };
        return;
      }

      const rawClientIp = ctx.request.headers['x-client-ip'];
      const clientIp = (typeof rawClientIp === 'string' && rawClientIp.trim().length > 0)
        ? rawClientIp.split(',')[0].trim()
        : ctx.ip || '127.0.0.1';
      const ipHash = hashIp(clientIp);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Per-IP rate limiting: at most 5 sends per IP per hour, and 20 sends per IP per day
      const hourlyRequestsForIp = await strapi.documents('api::otp-request.otp-request').findMany({
        filters: {
          ipHash: { $eq: ipHash },
          createdAt: { $gte: oneHourAgo.toISOString() },
        },
      });

      if (hourlyRequestsForIp.length >= 5) {
        ctx.status = 429;
        ctx.body = { success: false, message: 'Too many requests. Please try again later.', retryAfterSeconds: 3600 };
        return;
      }

      const dailyRequestsForIp = await strapi.documents('api::otp-request.otp-request').findMany({
        filters: {
          ipHash: { $eq: ipHash },
          createdAt: { $gte: oneDayAgo.toISOString() },
        },
      });

      if (dailyRequestsForIp.length >= 20) {
        ctx.status = 429;
        ctx.body = { success: false, message: 'Too many requests. Please try again later.', retryAfterSeconds: 86400 };
        return;
      }

      const { phone } = (ctx.request.body ?? {}) as { phone?: string };

      if (typeof phone !== 'string' || !PHONE_REGEX.test(phone)) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Invalid or expired code' }; // Generic
        return;
      }

      // Check per-phone limits
      const recentRequests = await strapi.documents('api::otp-request.otp-request').findMany({
        filters: {
          phone: { $eq: phone },
          createdAt: { $gte: oneDayAgo.toISOString() },
        },
        sort: { createdAt: 'desc' },
      });

      if (recentRequests.length >= MAX_SENDS_PER_24H) {
        ctx.status = 429;
        ctx.body = { success: false, message: 'Too many requests. Please try again later.', retryAfterSeconds: 86400 };
        return;
      }

      const mostRecent = recentRequests[0];
      if (mostRecent && (now.getTime() - new Date(mostRecent.createdAt as string).getTime()) < RESEND_COOLDOWN_MS) {
        ctx.status = 429;
        ctx.body = { success: false, message: 'Please wait before requesting another OTP', retryAfterSeconds: 60 };
        return;
      }

      // Invalidate old active OTPs for this phone
      const activeOtps = recentRequests.filter(r => !r.verified && new Date(r.expiresAt as string) > now);
      for (const otp of activeOtps) {
        await strapi.documents('api::otp-request.otp-request').update({
          documentId: otp.documentId,
          data: { attempts: MAX_ATTEMPTS + 1 },
        });
      }

      const code = generateOtpCode();
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      await strapi.documents('api::otp-request.otp-request').create({
        data: {
          phone,
          code: hashOtp(phone, code),
          expiresAt: expiresAt.toISOString(),
          verified: false,
          attempts: 0,
          ipHash,
        },
      });

      try {
        const pinnacleUrl = process.env.PINNACLE_API_URL;
        const accessKey = process.env.PINNACLE_ACCESS_KEY;

        if (!pinnacleUrl || !accessKey) {
          throw new Error('Pinnacle SMS gateway is not configured.');
        }

        const response = await fetch(pinnacleUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: '1.0',
            accesskey: accessKey,
            messages: [{
              dest: [phone],
              msg: `${code} is your OTP. Do not share this OTP with anyone. Muthoot Exim.`,
              type: 'PM',
              header: 'MUTEXM',
              app_country: '1',
              country_cd: '91',
            }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Pinnacle gateway responded with status ${response.status}`);
        }
      } catch (err) {
        strapi.log.error(`[otp-request] Failed to send OTP for phone ending in ${maskPhone(phone)}`);
        if (process.env.NODE_ENV === 'development') {
          strapi.log.info(`[otp-request] DEV MODE: OTP sent for ${maskPhone(phone)}`);
        } else {
          ctx.status = 502;
          ctx.body = { success: false, message: 'Failed to send OTP. Please try again.' };
          return;
        }
      }

      ctx.status = 200;
      ctx.body = { success: true, message: 'If the number is valid, a code has been sent' };
    },

    async verifyOtp(ctx: Context) {
      // Inject sanitization
      try {
        const { sanitizePayload, validateStringLengths } = require('../../../utils/sanitize-input');
        if (ctx.request.body) {
          if (!validateStringLengths(ctx.request.body)) {
            ctx.status = 400;
            ctx.body = { success: false, message: 'Payload contains strings that are too long' };
            return;
          }
          ctx.request.body = sanitizePayload(ctx.request.body);
        }
      } catch (err) {
        // Ignore if file not found, but it should exist
      }

      const secret = ctx.request.headers['x-internal-secret'];
      const expected = process.env.INTERNAL_API_SECRET;
      if (!expected || !secret || typeof secret !== 'string' || !safeCompare(secret, expected)) {
        ctx.status = 403;
        ctx.body = { success: false, message: 'Forbidden' };
        return;
      }

      const { phone, otp, name, email, state, city, branchCode, address, purity, weight, message, consent, sourceForm, enquiryType } = (ctx.request.body ?? {}) as {
        phone?: string;
        otp?: string;
        name?: string;
        email?: string;
        state?: string;
        city?: string;
        branchCode?: string;
        address?: string;
        purity?: string;
        weight?: string;
        message?: string;
        consent?: boolean;
        sourceForm?: string;
        enquiryType?: string;
      };

      if (typeof phone !== 'string' || !PHONE_REGEX.test(phone) || typeof otp !== 'string') {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Invalid or expired code' };
        return;
      }

      const entry = await strapi.documents('api::otp-request.otp-request').findFirst({
        filters: { phone: { $eq: phone }, verified: { $eq: false } },
        sort: { createdAt: 'desc' },
      });

      if (!entry) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Invalid or expired code' };
        return;
      }

      if (new Date(entry.expiresAt as string) < new Date()) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Invalid or expired code' };
        return;
      }

      const nextAttempts = (entry.attempts ?? 0) + 1;
      if (nextAttempts > MAX_ATTEMPTS) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Invalid or expired code' };
        return;
      }

      if (!safeCompare(entry.code as string, hashOtp(phone, otp))) {
        await strapi.documents('api::otp-request.otp-request').update({
          documentId: entry.documentId,
          data: { attempts: nextAttempts },
        });
        ctx.status = 400;
        ctx.body = { success: false, message: 'Invalid or expired code' };
        return;
      }

      await strapi.documents('api::otp-request.otp-request').update({
        documentId: entry.documentId,
        data: {
          verified: true,
          attempts: nextAttempts,
          name,
          state,
          city,
          message,
          consent: !!consent,
        },
      });

      // Dual-Write Mirror to Target Collection
      if (name && typeof name === 'string' && name.trim()) {
        try {
          const srcStr = `${sourceForm || ''} ${enquiryType || ''}`.toLowerCase();
          const location = [city, state].filter(Boolean).join(', ');

          if (srcStr.includes('van') || srcStr.includes('mobile')) {
            const vanService = strapi.service('api::mobile-van-submission.mobile-van-submission') as unknown as {
              submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
            };
            if (vanService) {
              await vanService.submitAndSync({
                name: name.trim(),
                phone,
                email,
                city: city || undefined,
                state: state || undefined,
                branchCode: branchCode || undefined,
                address: address || undefined,
                purity: purity || undefined,
                weight: weight || undefined,
                details: { purity, weight, city, state, address, message },
                submittedAt: new Date().toISOString(),
              });
            }
          } else if (srcStr.includes('contact')) {
            const contactService = strapi.service('api::contact-submission.contact-submission') as unknown as {
              submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
            };
            if (contactService) {
              await contactService.submitAndSync({
                name: name.trim(),
                phone,
                email,
                branch: location || undefined,
                branchCode: branchCode || undefined,
                message: message || undefined,
                submittedAt: new Date().toISOString(),
              });
            }
          } else if (srcStr.includes('blog')) {
            const blogEnquiryService = strapi.service('api::blog-enquiry.blog-enquiry') as unknown as {
              submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
            };
            if (blogEnquiryService) {
              await blogEnquiryService.submitAndSync({
                name: name.trim(),
                phone,
                email,
                branchCode: branchCode || undefined,
                blogTitle: sourceForm?.replace(/^Blog:\s*/i, '') || 'Blog',
                submittedAt: new Date().toISOString(),
              });
            }
          } else if (srcStr.includes('value') || srcStr.includes('valuation') || srcStr.includes('modal') || srcStr.includes('rate')) {
            const goldService = strapi.service('api::gold-valuation-submission.gold-valuation-submission') as any;
            if (goldService) {
              await goldService.submitAndSync({
                name: name.trim(),
                phone,
                email,
                branch: location || undefined,
                branchCode: branchCode || undefined,
                purity: purity || undefined,
                weight: weight || undefined,
                sourceForm: sourceForm || `Sell Gold Modal (Purity: ${purity || 'N/A'}, Weight: ${weight || '0'}g)`,
                details: { purity, weight, city, state, message },
                submittedAt: new Date().toISOString(),
              });
            }
          } else {
            const enquiryService = strapi.service('api::enquiry.enquiry') as any;
            if (enquiryService && enquiryService.createVerifiedEnquiry) {
              await enquiryService.createVerifiedEnquiry({
                name: name.trim(),
                mobile: phone,
                email: email || undefined,
                source: 'HOME_PAGE',
                otpVerified: true,
                branchCode: branchCode || undefined,
              });
            }
          }
        } catch (mirrorErr) {
          strapi.log.error('[otp-request] Failed to mirror submission to target collection');
        }
      }

      ctx.status = 200;
      ctx.body = { success: true, verified: true };
    },
  })
);
