import { errors } from '@strapi/utils';

const { ForbiddenError } = errors;

const VERIFICATION_WINDOW_MS = 15 * 60 * 1000;
const PHONE_REGEX = /^\d{10}$/;
const GENERIC_MESSAGE = 'Please verify your phone number again.';
const OTP_TABLE = 'otp_requests';

const maskPhone = (phone: string): string => {
  if (phone.length < 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
};

/**
 * Strapi-side OTP gate for lead-creating routes that don't verify in the same
 * request (unlike otp-request.verifyOtp, which mirrors the lead itself and sets
 * consumedAt directly). Claims the OTP atomically so a replayed request can't
 * reuse it: UPDATE ... WHERE consumed_at IS NULL, only proceeding if exactly one
 * row was affected.
 */
export async function requireVerifiedOtp(
  strapi: any,
  phone: unknown,
  formType?: string
): Promise<void> {
  if (typeof phone !== 'string' || !PHONE_REGEX.test(phone)) {
    strapi.log.warn(`[requireVerifiedOtp] rejected phone=invalid formType=${formType ?? 'unknown'} reason=invalid-phone`);
    throw new ForbiddenError(GENERIC_MESSAGE);
  }

  const cutoff = new Date(Date.now() - VERIFICATION_WINDOW_MS);

  const entry = await strapi.db
    .connection(OTP_TABLE)
    .where({ phone, verified: true })
    .whereNull('consumed_at')
    .andWhere('verified_at', '>=', cutoff)
    .orderBy('verified_at', 'desc')
    .first();

  if (!entry) {
    strapi.log.warn(`[requireVerifiedOtp] rejected phone=${maskPhone(phone)} formType=${formType ?? 'unknown'} reason=none-or-expired`);
    throw new ForbiddenError(GENERIC_MESSAGE);
  }

  const affectedRows = await strapi.db
    .connection(OTP_TABLE)
    .where({ id: entry.id })
    .whereNull('consumed_at')
    .update({ consumed_at: new Date() });

  if (affectedRows !== 1) {
    strapi.log.warn(`[requireVerifiedOtp] rejected phone=${maskPhone(phone)} formType=${formType ?? 'unknown'} reason=consumed`);
    throw new ForbiddenError(GENERIC_MESSAGE);
  }
}
