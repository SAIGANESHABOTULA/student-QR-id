import clsx from 'clsx'
import { LayoutDashboard, LogOut, Menu, ScanLine, ScrollText, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Logo, Spinner, ThemeToggle } from './ui'

export const GITHUB_URL = 'https://github.com/SAIGANESHABOTULA/student-QR-id'

export function PublicLayout() {
  const { admin } = useAuth()
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/"><Logo /></Link>
          <nav className="flex items-center gap-1">
            {pathname !== '/verify' && (
              <Link to="/verify" className="btn-primary !px-3 sm:!px-4"><ScanLine className="size-4" /><span className="hidden sm:inline">Verify an ID</span><span className="sm:hidden">Verify</span></Link>
            )}
            <Link to={admin ? '/admin' : '/login'} className="btn-ghost">{admin ? 'Console' : 'Admin'}</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-slate-200/70 py-8 text-sm text-slate-500 dark:border-slate-800/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <Logo className="!text-base" />
          <p>M.Tech project · Ed25519 signed credentials · React + FastAPI</p>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-brand-600">GitHub</a>
        </div>
      </footer>
    </div>
  )
}

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/scans', label: 'Scan log', icon: ScrollText },
]

export function AdminLayout() {
  const { admin, loading, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner className="size-8 text-brand-500" /></div>
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-2 pt-1">
        <Link to="/" onClick={() => setOpen(false)}><Logo /></Link>
        <button className="btn-ghost !p-1.5 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}>
            <Icon className="size-[18px]" /> {label}
          </NavLink>
        ))}
        <NavLink to="/verify" className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400">
          <ScanLine className="size-[18px]" /> Open verifier
        </NavLink>
      </nav>
      <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800/60">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{admin.name}</p>
          <p className="truncate text-xs text-slate-500">{admin.email}</p>
        </div>
        <ThemeToggle />
        <button onClick={logout} className="btn-ghost !p-2" aria-label="Sign out"><LogOut className="size-5" /></button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900"><div className="sticky top-0 h-dvh">{sidebar}</div></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-up bg-white dark:bg-slate-900">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/80">
          <button className="btn-ghost !p-2" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
          <Logo className="!text-base" />
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
