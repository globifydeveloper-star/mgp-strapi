export interface RemarksParams {
  formType?: string;
  sourceForm?: string;
  enquiryType?: string;
  state?: string;
  city?: string;
  branch?: string;
  branchName?: string;
  branchCode?: string;
  purity?: string;
  weight?: string | number;
  message?: string;
  branchValidated?: boolean;
}

/**
 * Shared helper to format Muthoot CRM `remarks` field uniformly across all forms.
 * Pattern: "[<formType>] <sourceForm> | Service: <enquiryType> | <city>, <state> | Branch: <branchName> (<branchCode>) | Purity: x | Weight: y g | Msg: <message>"
 * Omit empty parts, cap length at 500 chars.
 */
export function buildRemarks(params: RemarksParams): string {
  const parts: string[] = [];

  // Prefix [formType] + sourceForm
  const headerParts: string[] = [];
  if (params.formType && params.formType.trim()) {
    headerParts.push(`[${params.formType.trim()}]`);
  }
  if (params.sourceForm && params.sourceForm.trim()) {
    headerParts.push(params.sourceForm.trim());
  }
  if (headerParts.length > 0) {
    parts.push(headerParts.join(' '));
  }

  // Service / enquiryType
  if (
    params.enquiryType &&
    params.enquiryType.trim() &&
    params.enquiryType.trim() !== params.sourceForm?.trim() &&
    params.enquiryType.trim() !== 'Enquire Now' &&
    params.enquiryType.trim() !== 'Contact Us'
  ) {
    parts.push(`Service: ${params.enquiryType.trim()}`);
  }

  // City & State
  const locationParts = [params.city?.trim(), params.state?.trim()].filter(Boolean);
  if (locationParts.length > 0) {
    parts.push(locationParts.join(', '));
  }

  // Branch Name & Code
  const branchName = params.branchName?.trim() || params.branch?.trim();
  const branchCode = params.branchCode?.trim();
  if (branchName && branchCode) {
    parts.push(`Branch: ${branchName} (${branchCode})`);
  } else if (branchCode) {
    parts.push(`Branch: ${branchCode}`);
  } else if (branchName) {
    parts.push(`Branch: ${branchName}`);
  }

  // Purity
  if (params.purity && String(params.purity).trim()) {
    parts.push(`Purity: ${String(params.purity).trim()}`);
  }

  // Weight
  if (params.weight !== undefined && params.weight !== null && String(params.weight).trim() !== '') {
    parts.push(`Weight: ${String(params.weight).trim()}g`);
  }

  // Message
  if (params.message && params.message.trim()) {
    parts.push(`Msg: ${params.message.trim()}`);
  }

  // Branch validation status
  if (params.branchValidated === false) {
    parts.push('Branch unverified');
  }

  const result = parts.join(' | ');
  if (result.length > 500) {
    return result.slice(0, 497) + '...';
  }
  return result;
}
