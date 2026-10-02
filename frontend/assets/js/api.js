/**
 * api.js — Front-end API client
 * All fetch calls go through this module.
 * Handles auth cookies (credentials: 'include') and envelope unwrapping.
 */

const BASE = '/api';

class ApiError extends Error {
  constructor(code, message, fields) {
    super(message);
    this.code = code;
    this.fields = fields || {};
  }
}

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: {}
  };
  if (body !== undefined) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch (e) {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('PARSE_ERROR', 'Server returned an unexpected response.');
  }

  if (!res.ok || json.error) {
    const err = json.error || {};
    throw new ApiError(
      err.code || 'SERVER_ERROR',
      err.message || `Server error (${res.status})`,
      err.fields
    );
  }
  return json.data;
}

const get  = (path)        => request('GET',    path);
const post = (path, body)  => request('POST',   path, body);
const put  = (path, body)  => request('PUT',    path, body);
const del  = (path)        => request('DELETE', path);

// ── Auth ─────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (email, password, name)  => post('/auth/register', { email, password, name }),
    login:    (email, password)        => post('/auth/login',    { email, password }),
    logout:   ()                       => post('/auth/logout'),
    me:       ()                       => get('/auth/me'),
  },

  // ── Profile ────────────────────────────────────────────────────────────
  profile: {
    get:    ()    => get('/profile'),
    save:   (d)   => put('/profile', d),
  },

  // ── Income ─────────────────────────────────────────────────────────────
  income: {
    get:    ()    => get('/income'),
    save:   (d)   => put('/income', d),
  },

  // ── Tax Inputs ─────────────────────────────────────────────────────────
  taxInputs: {
    get:    (fy)  => get(`/tax-inputs${fy ? '?financialYear=' + encodeURIComponent(fy) : ''}`),
    save:   (d)   => put('/tax-inputs', d),
  },

  // ── Expenses ───────────────────────────────────────────────────────────
  expenses: {
    get:    (fy)  => get(`/expenses${fy ? '?financialYear=' + encodeURIComponent(fy) : ''}`),
    save:   (d)   => put('/expenses', d),
  },

  // ── Assets ─────────────────────────────────────────────────────────────
  assets: {
    list:     ()      => get('/assets'),
    create:   (d)     => post('/assets', d),
    update:   (id, d) => put(`/assets/${id}`, d),
    remove:   (id)    => del(`/assets/${id}`),
  },

  // ── Insurance ──────────────────────────────────────────────────────────
  insurance: {
    list:     ()      => get('/insurance'),
    create:   (d)     => post('/insurance', d),
    update:   (id, d) => put(`/insurance/${id}`, d),
    remove:   (id)    => del(`/insurance/${id}`),
  },

  // ── Liabilities ────────────────────────────────────────────────────────
  liabilities: {
    list:     ()      => get('/liabilities'),
    create:   (d)     => post('/liabilities', d),
    update:   (id, d) => put(`/liabilities/${id}`, d),
    remove:   (id)    => del(`/liabilities/${id}`),
  },

  // ── Goals ──────────────────────────────────────────────────────────────
  goals: {
    list:     ()      => get('/goals'),
    create:   (d)     => post('/goals', d),
    update:   (id, d) => put(`/goals/${id}`, d),
    remove:   (id)    => del(`/goals/${id}`),
  },

  // ── MF ─────────────────────────────────────────────────────────────────
  mf: {
    search:         (q)     => get(`/mf/schemes?search=${encodeURIComponent(q)}`),
    scheme:         (code)  => get(`/mf/schemes/${code}`),
    holdings:       ()      => get('/mf/holdings'),
    addHolding:     (d)     => post('/mf/holdings', d),
    updateHolding:  (id, d) => put(`/mf/holdings/${id}`, d),
    removeHolding:  (id)    => del(`/mf/holdings/${id}`),
    overlap:        ()      => get('/mf/overlap'),
  },

  // ── Analysis ───────────────────────────────────────────────────────────
  analysis: {
    run:      (opts = {}) => post('/analysis/run', opts),
    scenario: (overrides = {}, options = {}) => post('/analysis/scenario', { overrides, options }),
    history:  ()          => get('/analysis/history'),
    get:      (id)        => get(`/analysis/${id}`),
  },

  // ── Report ─────────────────────────────────────────────────────────────
  report: {
    pdfUrl: (planRunId) => `/api/report/${planRunId}/pdf`,
  },

  // ── Documents ───────────────────────────────────────────────────────────
  documents: {
    uploadForm16: (fileOrFormData) => {
      let formData;
      if (typeof FormData !== 'undefined' && fileOrFormData instanceof FormData) {
        formData = fileOrFormData;
      } else {
        formData = new FormData();
        formData.append('file', fileOrFormData);
      }
      return post('/documents/form16', formData);
    }
  },

  health: () => get('/health'),
};

export { ApiError };
