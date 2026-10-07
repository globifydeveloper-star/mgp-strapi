import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';
import { buildRemarks } from '../utils/remarks';
import type { FormSource } from '../../all-lead/services/all-lead';
import type { EnquiryForCrm } from '../utils/crmMapper';

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
  branchCode?: string;
  branch?: string;
  remarks?: string;
  formType?: string;
  sourceForm?: string;
  enquiryType?: string;
  city?: string;
  state?: string;
  branchName?: string;
  branchValidated?: boolean;
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

  let branchCode: string | undefined;
  if (input.branchCode !== undefined && input.branchCode !== null && input.branchCode !== '') {
    branchCode = requiredString(input.branchCode, 'branchCode');
  }

  const branch = typeof input.branch === 'string' && input.branch.trim() ? input.branch.trim() : undefined;
  const remarks = typeof input.remarks === 'string' && input.remarks.trim() ? input.remarks.trim() : undefined;
  const formType = typeof input.formType === 'string' && input.formType.trim() ? input.formType.trim() : undefined;
  const sourceForm = typeof input.sourceForm === 'string' && input.sourceForm.trim() ? input.sourceForm.trim() : undefined;
  const enquiryType = typeof input.enquiryType === 'string' && input.enquiryType.trim() ? input.enquiryType.trim() : undefined;
  const city = typeof input.city === 'string' && input.city.trim() ? input.city.trim() : undefined;
  const state = typeof input.state === 'string' && input.state.trim() ? input.state.trim() : undefined;
  const branchName = typeof input.branchName === 'string' && input.branchName.trim() ? input.branchName.trim() : undefined;
  const branchValidated = typeof input.branchValidated === 'boolean' ? input.branchValidated : undefined;

  return {
    name,
    mobile,
    email,
    source: source as EnquirySource,
    otpVerified: true,
    blog,
    branchCode,
    branch,
    remarks,
    formType,
    sourceForm,
    enquiryType,
    city,
    state,
    branchName,
    branchValidated,
  };
};

const publicEnquiry = (enquiry: Record<string, unknown>) => {
  const { crmError: _crmError, crmResponse: _crmResponse, ...safe } = enquiry;
  return safe;
};

export default factories.createCoreService('api::enquiry.enquiry', ({ strapi }) => ({
  async createVerifiedEnquiry(payload: unknown) {
    const input = validateInput(payload);
    const documents = strapi.documents('api::enquiry.enquiry');

    const formattedRemarks = buildRemarks({
      formType: input.formType || 'sell-gold-page',
      sourceForm: input.sourceForm || input.source,
      enquiryType: input.enquiryType,
      state: input.state,
      city: input.city,
      branch: input.branchName || input.branch,
      branchName: input.branchName,
      branchCode: input.branchCode,
      branchValidated: input.branchValidated,
      message: input.remarks,
    });

    const crmRequest: EnquiryForCrm = {
      name: input.name,
      mobile: input.mobile,
      email: input.email,
      leadSource: input.source,
      branchCode: input.branchCode ?? '',
      remarks: formattedRemarks,
    };

    // Persistence deliberately precedes the external call so a CRM outage cannot lose a lead.
    const enquiry = await documents.create({
      data: {
        name: input.name,
        mobile: input.mobile,
        email: input.email,
        source: input.source,
        otpVerified: true,
        blog: input.blog,
        branchCode: input.branchCode,
        crmStatus: 'PENDING',
        syncAttempts: 0,
        crmRequest,
      },
    });

    // Determine specific formSource for All Leads
    let allLeadFormSource: FormSource = 'Enquiry';
    if (input.formType === 'sell-gold-page') {
      allLeadFormSource = 'Sell Gold Page';
    } else if (input.formType === 'page-builder') {
      allLeadFormSource = 'Page Builder Enquiry';
    }

    if (!input.branchCode) {
      strapi.log.warn(`[crm] missing branchCode for api::enquiry.enquiry / ${enquiry.documentId}`);
    }

    // Background mirror and CRM push
    (async () => {
      try {
        const allLeadService = strapi.service('api::all-lead.all-lead') as any;
        let mirrorDocId: string | null = null;
        if (allLeadService?.mirrorLead) {
          mirrorDocId = await allLeadService.mirrorLead({
            name: input.name,
            phone: input.mobile,
            email: input.email,
            formSource: allLeadFormSource,
            sourceFormDetail: input.sourceForm || input.source,
            branch: input.branchName || input.branch,
            branchCode: input.branchCode,
            submittedAt: new Date().toISOString(),
            crmPushStatus: 'Pending',
          });
        }

        if (mirrorDocId) {
          await documents.update({
            documentId: enquiry.documentId,
            data: { allLeadDocumentId: mirrorDocId },
          });
        }

        const crmSync = strapi.service('api::all-lead.crm-sync') as any;
        if (crmSync?.pushOne) {
          await crmSync.pushOne('api::enquiry.enquiry', enquiry.documentId);
        }
      } catch (bgErr) {
        strapi.log.error(`[enquiry] Background sync error for ${enquiry.documentId}:`, bgErr);
      }
    })().catch((e) => strapi.log.error('[enquiry] Unhandled background error:', e));

    return publicEnquiry(enquiry as unknown as Record<string, unknown>);
  },
}));
