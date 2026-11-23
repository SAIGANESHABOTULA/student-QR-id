export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000'

const TOKEN_KEY = 'sid.auth'

export type VerifyResult = 'valid' | 'revoked' | 'superseded' | 'expired' | 'tampered' | 'malformed' | 'unknown'

export interface Admin { id: string; email: string; name: string }

export interface Student {
  id: string
  roll_no: string
  name: string
  department: string
  program: string
  year: number
  email: string | null
  blood_group: string | null
  valid_until: string
  status: 'active' | 'revoked'
  revoked_reason: string | null
  card_version: number
  has_photo: boolean
  photo_version: number
  created_at: string
  last_scanned_at: string | null
  scan_count: number
}

export type StudentInput = Partial<Pick<Student, 'roll_no' | 'name' | 'department' | 'program' | 'year' | 'email' | 'blood_group' | 'valid_until'>>

export interface VerifiedStudent {
  id: string
  roll_no: string
  name: string
  department: string
  program: string
  year: number
  blood_group: string | null
  valid_until: string
  has_photo: boolean
  photo_version: number
}

export interface VerifyResponse {
  result: VerifyResult
  valid: boolean
  message: string
  student: VerifiedStudent | null
  issued_at: number | null
  institution: string
}

export interface Scan {
  id: string
  student_id: string | null
  roll_no: string | null
  student_name: string | null
  result: VerifyResult
  reason: string
  created_at: string
}

export interface Stats {
  students_total: number
  students_active: number
  students_revoked: number
  students_expired: number
  scans_total: number
  scans_today: number
  scans_invalid: number
  by_department: Record<string, number>
  by_result: Record<string, number>
  daily: { day: string; valid: number; invalid: number }[]
  recent: Scan[]
}

export interface PublicKey { alg: string; kid: string; public_key: string; institution: string }
export interface Revocations { kid: string; revoked: string[]; card_versions: Record<string, number>; generated_at: string }
export interface DemoCredential { kind: VerifyResult; label: string; token: string }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable */ }
}

type Options = { method?: string; body?: unknown; form?: FormData; timeoutMs?: number; raw?: boolean }

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000)
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. It may be waking up - try again in a few seconds.')
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 401 && token) {
    setToken(null)
    window.dispatchEvent(new Event('sid:logout'))
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      const data = await res.json()
      msg = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg : msg
    } catch { /* not json */ }
    throw new ApiError(res.status, msg || `Request failed (${res.status})`)
  }
  if (opts.raw) return (await res.blob()) as T
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const photoUrl = (id: string, version = 0) => `${API_URL}/api/students/${id}/photo?v=${version}`

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; admin: Admin }>('/api/auth/login', { body: { email, password } }),
  me: () => request<Admin>('/api/auth/me'),

  verify: (token: string, timeoutMs = 25_000) => request<VerifyResponse>('/api/verify', { body: { token }, timeoutMs }),
  publicKey: () => request<PublicKey>('/api/public-key', { timeoutMs: 20_000 }),
  revocations: () => request<Revocations>('/api/revocations', { timeoutMs: 20_000 }),
  demoCredentials: () => request<DemoCredential[]>('/api/demo-credentials'),
  health: () => request<{ status: string }>('/api/health', { timeoutMs: 70_000 }),

  students: (params: { q?: string; department?: string; status?: string; limit?: number; offset?: number }) =>
    request<{ items: Student[]; total: number }>(`/api/students${qs(params)}`),
  departments: () => request<string[]>('/api/students/departments'),
  student: (id: string) => request<Student>(`/api/students/${id}`),
  createStudent: (body: StudentInput) => request<Student>('/api/students', { body }),
  updateStudent: (id: string, body: StudentInput) => request<Student>(`/api/students/${id}`, { method: 'PATCH', body }),
  deleteStudent: (id: string) => request<void>(`/api/students/${id}`, { method: 'DELETE' }),
  uploadPhoto: (id: string, file: Blob) => {
    const form = new FormData()
    form.append('file', file, 'photo.jpg')
    return request<Student>(`/api/students/${id}/photo`, { form })
  },
  revoke: (id: string, reason: string) => request<Student>(`/api/students/${id}/revoke`, { body: { reason } }),
  reinstate: (id: string) => request<Student>(`/api/students/${id}/reinstate`, { method: 'POST' }),
  reissue: (id: string) => request<Student>(`/api/students/${id}/reissue`, { method: 'POST' }),
  credential: (id: string) => request<{ token: string; kid: string; card_version: number }>(`/api/students/${id}/credential`),
  importCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ created: number; updated: number; errors: string[] }>('/api/students/import', { form })
  },
  exportCsv: () => request<Blob>('/api/students/export.csv', { raw: true }),

  stats: () => request<Stats>('/api/stats'),
  scans: (params: { result?: string; student_id?: string; limit?: number; offset?: number }) =>
    request<{ items: Scan[]; total: number }>(`/api/scans${qs(params)}`),
}
