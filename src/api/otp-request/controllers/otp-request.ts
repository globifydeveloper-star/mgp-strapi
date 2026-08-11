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
        strapi.log.error('[otp-request] Failed to send OTP via Pinnacle:', err);
        if (process.env.NODE_ENV !== 'production') {
          strapi.log.info(`[otp-request] DEV MODE: OTP for ${phone} is ${code}`);
        } else {
          ctx.status = 502;
          ctx.body = { success: false, message: 'Failed to send OTP. Please try again.' };
          return;
        }
      }

      ctx.status = 200;
      ctx.body = { success: true, message: 'OTP sent' };
    },

    async verifyOtp(ctx: Context) {
      const { phone, otp, name, email, state, city, purity, weight, message, consent, sourceForm, enquiryType } = (ctx.request.body ?? {}) as {
        phone?: string;
        otp?: string;
        name?: string;
        email?: string;
        state?: string;
        city?: string;
        purity?: string;
        weight?: string;
        message?: string;
        consent?: boolean;
        sourceForm?: string;
        enquiryType?: string;
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

      // Dual-Write Mirror to Target Collection (Mobile Van Submission, Contact Submission, or Form Submission)
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
                purity: purity || undefined,
                weight: weight || undefined,
                details: { purity, weight, city, state, message },
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
                message: message || undefined,
                submittedAt: new Date().toISOString(),
              });
            }
          } else {
            const formSubmissionService = strapi.service('api::form-submission.form-submission') as unknown as {
              submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
            };
            if (formSubmissionService) {
              await formSubmissionService.submitAndSync({
                name: name.trim(),
                phone,
                email,
                branch: location || undefined,
                enquiryType: enquiryType || (purity || weight ? 'Enquire Now' : 'Enquire Now'),
                sourceForm: sourceForm || (purity || weight ? `Sell Gold Modal (Purity: ${purity || 'N/A'}, Weight: ${weight || '0'}g)` : 'OTP Form'),
                purity: purity || undefined,
                weight: weight || undefined,
                details: { purity, weight, city, state, message },
                submittedAt: new Date().toISOString(),
              });
            }
          }
        } catch (mirrorErr) {
          strapi.log.error('[otp-request] Failed to mirror submission to target collection:', mirrorErr);
        }
      }

      ctx.status = 200;
      ctx.body = { success: true, verified: true };
    },

  })
);
