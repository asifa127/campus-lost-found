const KEY = 'clf_token';
export const NETWORK_ERROR = 'Unable to connect to the server. Please try again.';

export const tokenStore = {
  get: () => localStorage.getItem(KEY) || sessionStorage.getItem(KEY),
  set(token, remember) {
    this.clear();
    (remember ? localStorage : sessionStorage).setItem(KEY, token);
  },
  clear() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  },
};

export const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all'));
  return s.toString() ? `?${s}` : '';
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    if (res.status === 401 && token && !path.startsWith('/auth/login')) window.dispatchEvent(new Event('clf:unauthorized'));
    // a 5xx without our JSON body means the API itself is unreachable (for example the dev proxy has nothing to talk to)
    const err = new Error(json.message || (res.status >= 500 ? NETWORK_ERROR : 'Something went wrong'));
    err.status = res.status;
    throw err;
  }
  return json.data;
}

export const api = {
  get: (path, params) => request(path + qs(params)),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

// Plain object -> FormData (skips empty values) for endpoints that accept an image.
export function toFormData(values, fileField, file) {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  });
  if (file) fd.append(fileField, file);
  return fd;
}
