export default {
  routes: [
    { method: 'POST', path: '/otp/send', handler: 'otp-request.sendOtp', config: { auth: false } },
    { method: 'POST', path: '/otp/verify', handler: 'otp-request.verifyOtp', config: { auth: false } },
  ],
};
