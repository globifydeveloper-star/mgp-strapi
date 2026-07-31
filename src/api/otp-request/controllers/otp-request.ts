import type { Context } from 'koa';
import { factories } from '@strapi/strapi';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const PHONE_REGEX = /^\d{10}$/;

const generateOtpCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export default factories.createCoreController(
  'api::otp-request.otp-request',
  ({ strapi }) => ({
    async sendOtp(ctx: Context) {
      const { phone } = (ctx.request.body ?? {}) as { phone?: string };

      if (typeof phone !== 'string' || !PHONE_REGEX.test(phone)) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Phone number must be exactly 10 digits.' };
        return;
      }

      const now = new Date();

      const recent = await strapi.documents('api::otp-request.otp-request').findFirst({
        filters: {
          phone: { $eq: phone },
          createdAt: { $gte: new Date(now.getTime() - RESEND_COOLDOWN_MS).toISOString() },
          expiresAt: { $gte: now.toISOString() },
        },
      });

      if (recent) {
        ctx.status = 429;
        ctx.body = { success: false, message: 'Please wait before requesting another OTP' };
        return;
      }

      const code = generateOtpCode();
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      await strapi.documents('api::otp-request.otp-request').create({
        data: { phone, code, expiresAt: expiresAt.toISOString(), verified: false, attempts: 0 },
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
              header: 'MUTEXM', // DLT sender ID — confirm with client before go-live, see checklist
              app_country: '1',
              country_cd: '91',
            }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Pinnacle gateway responded with status ${response.status}`);
        }
      } catch (err) {
        strapi.log.error('[otp-request] Failed to send OTP via Pinnacle', err);
        ctx.status = 502;
        ctx.body = { success: false, message: 'Failed to send OTP. Please try again.' };
        return;
      }

      ctx.status = 200;
      ctx.body = { success: true, message: 'OTP sent' };
    },

    async verifyOtp(ctx: Context) {
      const { phone, otp, name, state, city, message, consent } = (ctx.request.body ?? {}) as {
        phone?: string;
        otp?: string;
        name?: string;
        state?: string;
        city?: string;
        message?: string;
        consent?: boolean;
      };

      if (typeof phone !== 'string' || !PHONE_REGEX.test(phone) || typeof otp !== 'string') {
        ctx.status = 400;
        ctx.body = { success: false, message: 'Phone and otp are required.' };
        return;
      }

      const entry = await strapi.documents('api::otp-request.otp-request').findFirst({
        filters: { phone: { $eq: phone }, verified: { $eq: false } },
        sort: { createdAt: 'desc' },
      });

      if (!entry) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'No pending OTP request found for this phone number.' };
        return;
      }

      if (new Date(entry.expiresAt as string) < new Date()) {
        ctx.status = 400;
        ctx.body = { success: false, message: 'OTP has expired. Please request a new one.' };
        return;
      }

      const nextAttempts = (entry.attempts ?? 0) + 1;
      if (nextAttempts > MAX_ATTEMPTS) {
        ctx.status = 429;
        ctx.body = { success: false, message: 'Too many attempts. Please request a new OTP.' };
        return;
      }

      if (entry.code !== otp) {
        await strapi.documents('api::otp-request.otp-request').update({
          documentId: entry.documentId,
          data: { attempts: nextAttempts },
        });
        ctx.status = 400;
        ctx.body = { success: false, message: 'Incorrect OTP.' };
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
          consent: !!consent
        },
      });

      ctx.status = 200;
      ctx.body = { success: true, verified: true };
    },

  })
);
