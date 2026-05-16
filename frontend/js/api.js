const API_BASE = '/api';

const Api = {
  _token: () => localStorage.getItem('mf_token'),

  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = this._token();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  },

  async _req(method, path, body) {
    showLoader(true);
    try {
      const opts = { method, headers: this._headers() };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(API_BASE + path, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } finally {
      showLoader(false);
    }
  },

  get: (p) => Api._req('GET', p),
  post: (p, b) => Api._req('POST', p, b),
  put: (p, b) => Api._req('PUT', p, b),
  patch: (p, b) => Api._req('PATCH', p, b),
  del: (p) => Api._req('DELETE', p),

  // Auth
  login: (body) => Api.post('/auth/login', body),
  register: (body) => Api.post('/auth/register', body),

  // Reference data
  getDepts: () => Api.get('/departments'),
  getDoctors: (deptId) => Api.get('/doctors' + (deptId ? '?department_id=' + deptId : '')),
  getSlots: (doctorId, date) => Api.get(`/doctors/${doctorId}/slots?date=${date}`),

  // Appointments
  getAppts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return Api.get('/appointments' + (q ? '?' + q : ''));
  },
  createAppt: (b) => Api.post('/appointments', b),
  updateAppt: (id, b) => Api.put('/appointments/' + id, b),
  updateStatus: (id, status) => Api.patch('/appointments/' + id + '/status', { status }),
  deleteAppt: (id) => Api.del('/appointments/' + id),

  // Stats
  getStats: () => Api.get('/stats'),
};
