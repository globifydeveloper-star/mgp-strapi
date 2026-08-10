import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { createCrmService } from './crm';

const { ValidationError } = errors;
const SOURCES = ['BLOG', 'CONTACT_US', 'HOME_PAGE', 'LANDING_PAGE', 'OTHER'] as const;
type EnquirySource = typeof SOURCES[number];

export interface CreateEnquiryInput {
  name: string;
  mobile: string;
  email?: string;
  source: EnquirySource;
  otpVerified: true;
  blog?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+?[0-9]{7,15}$/;

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} is required.`);
  }
  return value.trim();
};

const validateInput = (payload: unknown): CreateEnquiryInput => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('A valid enquiry payload is required.');
  }

  const input = payload as Record<string, unknown>;
  const name = requiredString(input.name, 'name');
  const mobile = requiredString(input.mobile, 'mobile');
  const source = requiredString(input.source, 'source');

  if (!MOBILE_PATTERN.test(mobile)) {
    throw new ValidationError('mobile must contain 7 to 15 digits, with an optional leading +.');
  }
  if (!SOURCES.includes(source as EnquirySource)) {
    throw new ValidationError(`source must be one of: ${SOURCES.join(', ')}.`);
  }
  if (input.otpVerified === false) {
    throw new ValidationError('Only OTP-verified enquiries can be submitted.');
  }

  let email: string | undefined;
  if (input.email !== undefined && input.email !== null && input.email !== '') {
    email = requiredString(input.email, 'email').toLowerCase();
    if (!EMAIL_PATTERN.test(email)) throw new ValidationError('email must be valid.');
  }

  let blog: string | undefined;
  if (input.blog !== undefined && input.blog !== null && input.blog !== '') {
    blog = requiredString(input.blog, 'blog');
  }

  return { name, mobile, email, source: source as EnquirySource, otpVerified: true, blog };
};

const publicEnquiry = (enquiry: Record<string, unknown>) => {
  const { crmError: _crmError, crmResponse: _crmResponse, ...safe } = enquiry;
  return safe;
};

export default factories.createCoreService('api::enquiry.enquiry', ({ strapi }) => ({
  async createVerifiedEnquiry(payload: unknown) {
    const input = validateInput(payload);
    const documents = strapi.documents('api::enquiry.enquiry');

    // Persistence deliberately precedes the external call so a CRM outage cannot lose a lead.
    let enquiry = await documents.create({
      data: {
        ...input,
        crmStatus: 'PENDING',
        syncAttempts: 0,
      },
    });

    // Dual-Write Mirror to Form Submissions & Specialized Collections
    try {
      if (input.source === 'BLOG') {
        const blogService = strapi.service('api::blog-enquiry.blog-enquiry') as any;
        if (blogService) await blogService.submitAndSync({ name: input.name, mobile: input.mobile, email: input.email, blogTitle: input.blog });
      } else if (input.source === 'CONTACT_US') {
        const contactService = strapi.service('api::contact-submission.contact-submission') as any;
        if (contactService) await contactService.submitAndSync({ name: input.name, phone: input.mobile, email: input.email });
      }
      
      const formSubmissionService = strapi.service('api::form-submission.form-submission') as unknown as {
        submitAndSync(payload: unknown): Promise<Record<string, unknown>>;
      };
      if (formSubmissionService) {
        await formSubmissionService.submitAndSync({
          name: input.name,
          phone: input.mobile,
          email: input.email,
          sourceForm: input.source,
          enquiryType: input.source === 'CONTACT_US' ? 'Contact Us' : (input.source === 'BLOG' ? 'Blog Enquiry' : 'Enquire Now'),
        });
      }
    } catch (mirrorErr) {
      strapi.log.error('[enquiry] Failed to mirror to specialized collection:', mirrorErr);
    }

    const crmConfig = strapi.config.get('crm') as {
      baseUrl: string;
      token: string;
      timeout: number;
    };
    const crm = createCrmService(crmConfig);

    try {
      const result = await crm.syncEnquiry(input);
      const updated = await documents.update({
        documentId: enquiry.documentId,
        data: {
          crmStatus: 'SYNCED',
          crmLeadId: result.leadId,
          crmResponse: JSON.parse(JSON.stringify(result.response)),
          syncAttempts: 1,
          lastSyncAt: new Date().toISOString(),
        },
      });
      if (updated) enquiry = updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown CRM error.';
      strapi.log.error(`[enquiry] CRM sync failed for ${enquiry.documentId}: ${message}`);

      const updated = await documents.update({
        documentId: enquiry.documentId,
        data: {
          crmStatus: 'FAILED',
          crmError: message,
          syncAttempts: 1,
          lastSyncAt: new Date().toISOString(),
        },
      });
      if (updated) enquiry = updated;
    }

    return publicEnquiry(enquiry as unknown as Record<string, unknown>);
  },
}));
