import clsx from 'clsx'
import {
  AlertTriangle, BadgeCheck, Ban, CalendarX2, FileQuestion, Loader2, Moon, RefreshCcw, ShieldAlert, ShieldCheck, Sun, UserX, X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { photoUrl, type VerifyResult } from '../lib/api'
import type { DisplayStatus } from '../lib/format'
import { initials } from '../lib/format'
import { useTheme } from '../lib/theme'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 font-display text-lg font-bold', className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-sky-500 text-white shadow-md shadow-brand-500/30">
        <ShieldCheck className="size-5" strokeWidth={2.4} />
      </span>
      Secure<span className="-ml-2 text-brand-600 dark:text-brand-400">ID</span>
    </span>
  )
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button onClick={toggle} className="btn-ghost !p-2" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx('animate-spin', className ?? 'size-5')} />

const STATUS_STYLES: Record<DisplayStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  revoked: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
  expired: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-400',
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset', STATUS_STYLES[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export const RESULT_META: Record<VerifyResult, { label: string; tone: 'good' | 'warn' | 'bad'; icon: typeof ShieldCheck }> = {
  valid: { label: 'Verified', tone: 'good', icon: BadgeCheck },
  revoked: { label: 'Revoked', tone: 'bad', icon: Ban },
  superseded: { label: 'Old card', tone: 'warn', icon: RefreshCcw },
  expired: { label: 'Expired', tone: 'warn', icon: CalendarX2 },
  tampered: { label: 'Forged', tone: 'bad', icon: ShieldAlert },
  malformed: { label: 'Not a SecureID QR', tone: 'bad', icon: FileQuestion },
  unknown: { label: 'Unknown student', tone: 'warn', icon: UserX },
}

const TONE = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  warn: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-400',
  bad: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
}

export function ResultBadge({ result }: { result: VerifyResult }) {
  const meta = RESULT_META[result] ?? RESULT_META.malformed
  const Icon = meta.icon
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE[meta.tone])}>
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  )
}

export function Avatar({ id, name, version = 0, hasPhoto = true, className }: {
  id: string; name: string; version?: number; hasPhoto?: boolean; className?: string
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [id, version])
  const showImg = hasPhoto && !failed
  return (
    <span className={clsx('relative inline-grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-brand-100 to-sky-100 font-display font-semibold text-brand-700 dark:from-brand-900/60 dark:to-sky-900/40 dark:text-brand-300', className ?? 'size-10 rounded-full text-sm')}>
      {showImg ? (
        <img src={photoUrl(id, version)} alt={name} crossOrigin="anonymous" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('card relative max-h-[92vh] w-full animate-fade-up overflow-y-auto rounded-b-none p-6 sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel, danger, busy, children }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel: string
  danger?: boolean; busy?: boolean; children?: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex gap-3">
        {danger && <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />}
        <div className="text-sm text-slate-600 dark:text-slate-300">{body}</div>
      </div>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="size-4" />} {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: typeof ShieldCheck; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  )
}
