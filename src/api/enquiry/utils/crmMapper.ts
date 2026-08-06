export interface EnquiryForCrm {
  name: string;
  mobile: string;
  email?: string;
  gender?: string;
  interestedInSWJ?: boolean;
  interestedInSWH?: boolean;
  interestedInMGP?: boolean;
  interestedInESwarna?: boolean;
  totalWtGms?: number;
  leadSource?: string;
  leadStatus?: string;
  losingReason?: string;
  followupDate?: string;
  remarks?: string;
}

export interface CrmLeadPayload {
  leadId: number;
  uniqCustId: string;
  name: string;
  gender: string;
  mobile: string;
  emailId: string;
  interestedInSWJ: boolean;
  interestedInSWH: boolean;
  interestedInMGP: boolean;
  interestedInESwarna: boolean;
  totalWtGms: number;
  leadSource: string;
  leadStatus: string;
  losingReason: string;
  followupDate: string;
  remarks: string;
}

/** Pure mapping function matching Muthoot Exim CRM /ChannelLead/Upsert payload schema */
export const mapEnquiryToCrm = (enquiry: EnquiryForCrm): CrmLeadPayload => ({
  leadId: 0,
  uniqCustId: '',
  name: enquiry.name,
  gender: enquiry.gender ?? 'Male',
  mobile: enquiry.mobile,
  emailId: enquiry.email ?? '',
  interestedInSWJ: enquiry.interestedInSWJ ?? true,
  interestedInSWH: enquiry.interestedInSWH ?? true,
  interestedInMGP: enquiry.interestedInMGP ?? true,
  interestedInESwarna: enquiry.interestedInESwarna ?? true,
  totalWtGms: enquiry.totalWtGms ?? 0,
  leadSource: enquiry.leadSource ?? '',
  leadStatus: enquiry.leadStatus ?? 'Open',
  losingReason: enquiry.losingReason ?? '',
  followupDate: enquiry.followupDate ?? new Date().toISOString(),
  remarks: enquiry.remarks ?? '',
});
