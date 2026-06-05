// ============================================================
// Centralized API client — replaces all supabase.* calls
// All HTTP calls go through this module.
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ── Token storage ─────────────────────────────────────────
const TOKEN_KEY = 'citrus_jwt';

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// ── Core fetch wrapper ────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    tokenStore.clear();
    window.location.href = '/login';
    throw new Error('Session expirée');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Multipart upload variant (photo)
async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    tokenStore.clear();
    window.location.href = '/login';
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { sub: string; email: string; role: string; domaineId: string | null } }>(
      '/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  register: (email: string, password: string, nomComplet: string, role: string, domaineId?: string | null) =>
    request<{ id: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nomComplet, role, domaineId }),
    }),
  guestLogin: () =>
    request<{ token: string; user: { sub: string; email: string; role: string; domaineId: string | null } }>(
      '/api/auth/guest-login', { method: 'POST' }
    ),
  me: () =>
    request<{ id: string; email: string; nomComplet: string | null; domaineId: string | null }>('/api/auth/me'),
};

// ── Référentiel ───────────────────────────────────────────
export const refApi = {
  campagnes: () => request<any[]>('/api/referentiel/campagnes'),
  createCampagne: (body: object) => request<any>('/api/referentiel/campagnes', { method: 'POST', body: JSON.stringify(body) }),
  updateCampagne: (id: number, body: object) => request<any>(`/api/referentiel/campagnes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCampagne: (id: number) => request<void>(`/api/referentiel/campagnes/${id}`, { method: 'DELETE' }),

  varietes: (typeId?: string) =>
    request<any[]>(`/api/referentiel/varietes${typeId ? `?typeId=${typeId}` : ''}`),
  createVariete: (body: object) => request<any>('/api/referentiel/varietes', { method: 'POST', body: JSON.stringify(body) }),
  updateVariete: (id: number, body: object) => request<any>(`/api/referentiel/varietes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteVariete: (id: number) => request<void>(`/api/referentiel/varietes/${id}`, { method: 'DELETE' }),

  porteGreffes: () => request<any[]>('/api/referentiel/porte-greffes'),
  typesVarietes: () => request<any[]>('/api/referentiel/types-varietes'),

  domaines: () => request<any[]>('/api/referentiel/domaines'),
  domaine: (id: number) => request<any>(`/api/referentiel/domaines/${id}`),
  createDomaine: (body: object) => request<any>('/api/referentiel/domaines', { method: 'POST', body: JSON.stringify(body) }),
  updateDomaine: (id: number, body: object) => request<any>(`/api/referentiel/domaines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDomaine: (id: number) => request<void>(`/api/referentiel/domaines/${id}`, { method: 'DELETE' }),

  domaineVarietes: (domaineId?: number) =>
    request<any[]>(`/api/referentiel/domaine-varietes${domaineId ? `?domaineId=${domaineId}` : ''}`),
  createDomaineVariete: (body: object) => request<any>('/api/referentiel/domaine-varietes', { method: 'POST', body: JSON.stringify(body) }),
  updateDomaineVariete: (id: number, body: object) => request<any>(`/api/referentiel/domaine-varietes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDomaineVariete: (id: number) => request<void>(`/api/referentiel/domaine-varietes/${id}`, { method: 'DELETE' }),
};

// ── Productions ───────────────────────────────────────────
export const productionApi = {
  list: (params?: { campagneId?: string; domaineId?: string; varieteId?: string; statut?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.campagneId) qs.set('campagneId', params.campagneId);
    if (params?.domaineId) qs.set('domaineId', params.domaineId);
    if (params?.varieteId) qs.set('varieteId', params.varieteId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<{ data: any[]; total: number; page: number; limit: number }>(
      `/api/productions?${qs.toString()}`
    );
  },
  get: (id: string) => request<any>(`/api/productions/${id}`),
  create: (formData: FormData) => upload<any>('/api/productions', formData),
  createJson: (body: object) =>
    request<any>('/api/productions', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request<any>(`/api/productions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateWithPhoto: async (id: string, formData: FormData) => {
    const token = tokenStore.get();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/api/productions/${id}`, { method: 'PATCH', headers, body: formData });
    if (!res.ok) { const b = await res.json(); throw new Error(b.error); }
    return res.json();
  },
  delete: (id: string | number) => request<void>(`/api/productions/${id}`, { method: 'DELETE' }),
  validate: (id: string | number, status: 'Validé' | 'Rejeté', comment?: string) =>
    request<any>(`/api/productions/${id}/validate`, { method: 'PATCH', body: JSON.stringify({ status, comment }) }),
  bulkValidate: (ids: number[], status: 'Validé' | 'Rejeté', comment?: string) =>
    request<{ ok: boolean; count: number }>(
      '/api/productions/bulk-validate', { method: 'POST', body: JSON.stringify({ ids, status, comment }) }
    ),
  sync: (records: any[]) =>
    request<{ inserted: number; skipped: number; errors: string[] }>(
      '/api/productions/sync', { method: 'POST', body: JSON.stringify({ records }) }
    ),
};

// ── Qualité ───────────────────────────────────────────────
export const qualiteApi = {
  list: (params?: { campagneId?: string; domaineId?: string; varieteId?: string; statut?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.campagneId) qs.set('campagneId', params.campagneId);
    if (params?.domaineId) qs.set('domaineId', params.domaineId);
    if (params?.varieteId) qs.set('varieteId', params.varieteId);
    if (params?.statut) qs.set('statut', params.statut);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<{ data: any[]; total: number; page: number; limit: number }>(`/api/qualite?${qs.toString()}`);
  },
  get: (id: number | string) => request<any>(`/api/qualite/${id}`),
  create: (body: object) => request<any>('/api/qualite', { method: 'POST', body: JSON.stringify(body) }),
  createWithPhoto: (formData: FormData) => upload<any>('/api/qualite', formData),
  update: (id: number | string, body: object) =>
    request<any>(`/api/qualite/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateWithPhoto: async (id: number | string, formData: FormData) => {
    const token = tokenStore.get();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/api/qualite/${id}`, { method: 'PATCH', headers, body: formData });
    if (!res.ok) { const b = await res.json(); throw new Error(b.error); }
    return res.json();
  },
  validate: (id: number | string, status: 'Validé' | 'Rejeté', comment?: string) =>
    request<any>(`/api/qualite/${id}/validate`, { method: 'PATCH', body: JSON.stringify({ status, comment }) }),
  delete: (id: number | string) => request<void>(`/api/qualite/${id}`, { method: 'DELETE' }),
  seuils: (codeVariete?: string) =>
    request<any[]>(`/api/qualite/seuils${codeVariete ? `?codeVariete=${codeVariete}` : ''}`),
};

// ── Phénologie ────────────────────────────────────────────
export const phenologieApi = {
  list: (campagneId?: string) =>
    request<any[]>(`/api/phenologie${campagneId ? `?campagneId=${campagneId}` : ''}`),
  get: (id: string) => request<any>(`/api/phenologie/${id}`),
  create: (body: object) =>
    request<any>('/api/phenologie', { method: 'POST', body: JSON.stringify(body) }),
  addObservation: (body: object) =>
    request<any>('/api/phenologie/observations', { method: 'POST', body: JSON.stringify(body) }),
  rappels: () => request<any[]>('/api/phenologie/rappels'),
  markRappelLu: (id: string) =>
    request<any>(`/api/phenologie/rappels/${id}/lu`, { method: 'PATCH' }),
};

// ── Notifications ─────────────────────────────────────────
export const notifApi = {
  list: (onlyUnread = false) =>
    request<any[]>(`/api/notifications${onlyUnread ? '?unread=true' : ''}`),
  unreadCount: () => request<{ count: number }>('/api/notifications/unread-count'),
  markRead: (id: string) => request<any>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request<void>('/api/notifications/read-all', { method: 'PATCH' }),
  // SSE stream URL (used with EventSource)
  streamUrl: () => `${BASE_URL}/api/notifications/stream`,
};

// ── Admin ─────────────────────────────────────────────────
export const adminApi = {
  listUsers: () => request<any[]>('/api/admin/users'),
  getUser: (id: string) => request<any>(`/api/admin/users/${id}`),
  createUser: (body: object) =>
    request<{ id: string }>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: object) =>
    request<any>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  getPermissions: (id: string) => request<any[]>(`/api/admin/users/${id}/permissions`),
  setPermissions: (id: string, permissions: any[]) =>
    request<any[]>(`/api/admin/users/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
};

// ── Exports ───────────────────────────────────────────────
export const exportApi = {
  history: () => request<any[]>('/api/exports/history'),
  productions: (params?: { campagneId?: string; domaineId?: string; varieteId?: string; format?: 'json' | 'csv' }) => {
    const qs = new URLSearchParams();
    if (params?.campagneId) qs.set('campagneId', params.campagneId);
    if (params?.domaineId) qs.set('domaineId', params.domaineId);
    if (params?.varieteId) qs.set('varieteId', params.varieteId);
    if (params?.format) qs.set('format', params.format);
    return request<any[]>(`/api/exports/productions?${qs.toString()}`);
  },
};
