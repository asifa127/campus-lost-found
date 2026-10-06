// Single source of truth for rules the server enforces and the UI displays (Settings page, README).
export const policy = {
  password: {
    minLength: 8,
    rule: 'Password must be at least 8 characters with upper-case, lower-case and a number',
  },
  session: { standardDays: 1, rememberDays: 30 },
  upload: {
    maxMb: 5,
    formats: ['JPG', 'PNG', 'WEBP'],
    message: 'Please upload a JPG, PNG, or WEBP image under 5 MB.',
  },
  bcryptRounds: 10,
};
