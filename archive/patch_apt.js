const fs = require('fs');
const path = require('path');

const file = 'd:\\MGP\\MGP-WEB\\src\\components\\mobilevantab\\appoinment\\appoinment.tsx';
let content = fs.readFileSync(file, 'utf-8');

// 1. Add address to formData state
content = content.replace(
  /branchCode: '',\n\s*consent: false,/g,
  `branchCode: '',\n    address: '',\n    consent: false,`
);

// 2. Add validation
content = content.replace(
  /const otpErr = validateOtp\(otp\);/g,
  `const addressErr = validateRequired(formData.address, 'Address');\n    if (addressErr) newErrors.address = addressErr;\n\n    const otpErr = validateOtp(otp);`
);

// 3. Add address to verifyOtp
content = content.replace(
  /branchName: availableBranches\.find\(b => b\.branchCode === formData\.branchCode\)\?\.branchName,\n\s*consent: formData\.consent,/g,
  `branchName: availableBranches.find(b => b.branchCode === formData.branchCode)?.branchName,\n      address: formData.address,\n      consent: formData.consent,`
);

// 4. Add the JSX field before consent
const jsxField = `
                <div className="apt-form-row">
                  <div className="apt-field" style={{ width: '100%' }}>
                    <label htmlFor="apt-address" className="apt-label">Address<span className="apt-required">*</span></label>
                    <textarea
                      id="apt-address"
                      name="address"
                      className="apt-input"
                      placeholder="Enter your complete address"
                      disabled={otpState === 'sending' || otpState === 'verifying'}
                      value={formData.address}
                      onChange={handleChange as any}
                      style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit', padding: '0.75rem 1rem' }}
                    />
                    {errors.address && <span className="otp-error-msg" style={{color: '#DC2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block'}}>{errors.address}</span>}
                  </div>
                </div>

                <label className="apt-consent">`;

content = content.replace(
  /<label className="apt-consent">/g,
  jsxField
);

// 5. Add to disabled condition
content = content.replace(
  /!formData\.branchCode \|\|\n\s*!formData\.consent/g,
  `!formData.branchCode ||\n                    !formData.address ||\n                    !formData.consent`
);

fs.writeFileSync(file, content);
console.log('Successfully patched appointment.tsx');
