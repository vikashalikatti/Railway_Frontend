/*
 * Frontend checks. Each rule returns an error message, or '' when the value is fine.
 * The backend still has the final say (e.g. duplicate email/mobile at signup).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;

export const rules = {
  required: (label) => (v) => (String(v ?? '').trim() ? '' : `Enter ${label}.`),

  personName: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 'Enter your full name.';
    if (s.length < 2) return 'Name must be at least 2 characters.';
    if (s.length > 50) return 'Name can be at most 50 characters.';
    if (!NAME_RE.test(s)) return 'Use letters and spaces only.';
    return '';
  },

  email: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 'Enter your email address.';
    if (s.length > 100 || !EMAIL_RE.test(s)) return 'Enter a valid email address, like name@example.com.';
    return '';
  },

  mobile: (v) => {
    const s = String(v ?? '');
    if (!s) return 'Enter your mobile number.';
    if (!/^\d{10}$/.test(s)) return 'Mobile number must be 10 digits.';
    if (!/^[6-9]/.test(s)) return 'Mobile number must start with 6, 7, 8 or 9.';
    return '';
  },

  /** For new passwords only. Log-in forms just check the field isn't empty. */
  newPassword: (v) => {
    const s = String(v ?? '');
    if (!s) return 'Enter a password.';
    if (s.length < 8) return 'Password must be at least 8 characters.';
    if (s.length > 64) return 'Password can be at most 64 characters.';
    if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use at least one letter and one number.';
    if (/\s/.test(s)) return 'Password can’t contain spaces.';
    return '';
  },

  confirm: (other) => (v) => (!v ? 'Repeat the password.' : v !== other ? 'The passwords don’t match.' : ''),

  age: (v) => {
    if (v === '' || v == null) return 'Enter your age.';
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 120) return 'Enter an age between 1 and 120.';
    return '';
  },

  address: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 'Enter your address.';
    if (s.length < 5) return 'Address is too short.';
    if (s.length > 200) return 'Address can be at most 200 characters.';
    return '';
  },

  otp: (v) => (/^\d{6}$/.test(String(v ?? '')) ? '' : 'OTP is the 6-digit code from the email.'),

  adminName: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 'Enter the admin name.';
    if (s.length < 3 || s.length > 30) return 'Admin name must be 3 to 30 characters.';
    if (!/^[A-Za-z0-9_.]+$/.test(s)) return 'Use letters, numbers, dots or underscores, with no spaces.';
    return '';
  },

  station: (label) => (v) => {
    const s = String(v ?? '').trim();
    if (!s) return `Enter the ${label} station.`;
    if (s.length < 2) return 'Station name is too short.';
    return '';
  },

  trainNumber: (v) => (/^\d{5}$/.test(String(v ?? '')) ? '' : 'Train number must be 5 digits.'),

  positive: (label, max) => (v) => {
    if (v === '' || v == null) return `Enter the ${label}.`;
    const n = Number(v);
    if (!(n > 0)) return `The ${label} must be more than 0.`;
    if (max && n > max) return `The ${label} can be at most ${max}.`;
    return '';
  },

  photo: (file) => {
    if (!file) return 'Add a profile photo.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPG, PNG or WebP image.';
    if (file.size > 5 * 1024 * 1024) return 'Photo must be 5 MB or smaller.';
    return '';
  },
};

/**
 * Run a set of checks. `schema` maps field → rule (or array of rules).
 * Returns { field: message } with only the fields that failed.
 */
export function check(values, schema) {
  const errors = {};
  Object.entries(schema).forEach(([field, rule]) => {
    const list = Array.isArray(rule) ? rule : [rule];
    for (const r of list) {
      const msg = r(values[field], values);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  });
  return errors;
}

/** Move keyboard focus to the first field that has an error */
export function focusFirstError(form) {
  const el = form?.querySelector('[aria-invalid="true"]');
  if (el) el.focus();
}
