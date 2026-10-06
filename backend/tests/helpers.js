// Shared helpers for the API tests. They talk to a running API (default http://localhost:5000/api)
// that has been seeded with `npm run seed`.
export const API = process.env.API_URL || 'http://localhost:5000/api';
export const ORIGIN = API.replace(/\/api$/, '');

export async function call(path, { token, method = 'GET', body, form, base = API } = {}) {
  if (method === 'GET' || method === 'HEAD') { body = undefined; form = undefined; }
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

export const login = async (email, password) => (await call('/auth/login', { method: 'POST', body: { email, password } })).data.token;

// Role logins are reused within a test file (each file runs in its own process).
const cache = new Map();
const cached = (email, password) => {
  if (!cache.has(email)) cache.set(email, login(email, password));
  return cache.get(email);
};
export const asStudent = () => cached('student@campus.com', 'Student@123');
export const asOtherStudent = () => cached('meera.nair@campus.com', 'Student@123');
export const asStaff = () => cached('staff@campus.com', 'Staff@123');
export const asAdmin = () => cached('admin@campus.com', 'Admin@123');

// unique suffix so repeated runs never collide on emails / ids
export const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const today = () => new Date().toISOString().slice(0, 10);

// 1x1 PNG, enough to pass the content check
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
export const imageForm = (fields, { bytes = PNG, type = 'image/png', name = 'photo.png', field = 'image' } = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  if (bytes) form.append(field, new Blob([bytes], { type }), name);
  return form;
};

export const lostPayload = (over = {}) => ({
  itemName: `Test item ${uid}`, category: 'Electronics', description: 'Created by an automated test', color: 'Black',
  location: 'Library', date: today(), ...over,
});

export const registerUser = async (over = {}) => {
  const n = Math.random().toString(36).slice(2, 8);
  const body = {
    name: `Temp ${n}`, studentId: `T${uid}${n}`, email: `t${uid}${n}@campus.com`, phone: '9999999999',
    password: 'Temp@1234', department: 'CSE', year: '1st Year', ...over,
  };
  const res = await call('/auth/register', { method: 'POST', body });
  return { ...res, body };
};
