export interface EnquiryForCrm {
  name: string;
  mobile: string;
  email?: string;
}

export interface CrmLeadPayload {
  leadId: number;
  uniqCustId: string;
  name: string;
  mobile: string;
  emailId: string;
  leadStatus: 'Open';
  interestedInMGP: true;
  remarks: 'OTP Verified';
}

/** Pure mapping function; CRM transport concerns belong in the CRM service. */
export const mapEnquiryToCrm = (enquiry: EnquiryForCrm): CrmLeadPayload => ({
  leadId: 0,
  uniqCustId: '',
  name: enquiry.name,
  mobile: enquiry.mobile,
  emailId: enquiry.email ?? '',
  leadStatus: 'Open',
  interestedInMGP: true,
  remarks: 'OTP Verified',
});
