import { Lock, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'

// Optional public-demo convenience: pre-fill the login form from build-time env vars.
const DEMO_EMAIL = (import.meta.env.VITE_DEMO_EMAIL as string | undefined) ?? ''
const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? ''
const DEMO = import.meta.env.VITE_DEMO_LOGIN === 'true' && !!DEMO_EMAIL && !!DEMO_PASSWORD

export default function Login() {
  const { admin, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/admin'
  const [email, setEmail] = useState(DEMO ? DEMO_EMAIL : '')
  const [password, setPassword] = useState(DEMO ? DEMO_PASSWORD : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (admin) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-12">
      <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="relative w-full max-w-sm animate-fade-up">
        <Link to="/" className="mb-8 flex justify-center"><Logo className="!text-2xl" /></Link>
        <form onSubmit={submit} className="card space-y-4 p-7">
          <div>
            <h1 className="text-xl font-bold">Admin console</h1>
            <p className="text-sm text-slate-500">Sign in to issue and manage ID cards.</p>
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
          <button className="btn-primary w-full !py-3" disabled={busy}>
            {busy ? <Spinner className="size-4" /> : <LogIn className="size-4" />} Sign in
          </button>
          {DEMO && (
            <p className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-center text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <Lock className="size-3.5" /> Demo credentials are pre-filled
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
