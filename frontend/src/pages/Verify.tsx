import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  CheckCircle2, ChevronDown, CircleDashed, CloudOff, History, KeyRound, RotateCcw, ScanLine, Server, Smartphone, Sparkles, XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Scanner } from '../components/Scanner'
import { Avatar, RESULT_META, ResultBadge, Spinner } from '../components/ui'
import { api, type VerifyResponse, type VerifyResult } from '../lib/api'
import { cachedKey, cachedRevocations, decodeToken, refreshTrustStore, verifyOnDevice, type LocalVerdict } from '../lib/credential'
import { fmtDate, ordinal, timeAgo } from '../lib/format'

interface Outcome {
  token: string
  local: LocalVerdict | null
  server: VerifyResponse | null
  serverState: 'pending' | 'done' | 'failed'
  at: number
}

interface HistoryItem { result: VerifyResult; name: string | null; roll: string | null; at: number }

const HISTORY_KEY = 'sid.history'
const loadHistory = (): HistoryItem[] => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

const TONE_BG = {
  good: 'from-emerald-500 to-teal-500',
  warn: 'from-amber-500 to-orange-500',
  bad: 'from-red-500 to-rose-600',
}

export default function Verify() {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory)
  const [trust, setTrust] = useState(() => ({ key: cachedKey(), rev: cachedRevocations(), online: navigator.onLine }))
  const busy = useRef(false)

  const demo = useQuery({ queryKey: ['demo'], queryFn: api.demoCredentials, staleTime: 5 * 60_000, retry: 2 })

  const syncTrust = useCallback(async () => {
    const ok = await refreshTrustStore()
    setTrust({ key: cachedKey(), rev: cachedRevocations(), online: ok })
  }, [])

  useEffect(() => {
    syncTrust()
    const id = setInterval(syncTrust, 5 * 60_000)
    return () => clearInterval(id)
  }, [syncTrust])

  const handle = useCallback(async (token: string) => {
    if (busy.current) return
    busy.current = true
    navigator.vibrate?.(40)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const local = await verifyOnDevice(token)
    setOutcome({ token, local, server: null, serverState: 'pending', at: Date.now() })
    let server: VerifyResponse | null = null
    try {
      server = await api.verify(token)
      setOutcome((o) => (o && o.token === token ? { ...o, server, serverState: 'done' } : o))
    } catch {
      setOutcome((o) => (o && o.token === token ? { ...o, serverState: 'failed' } : o))
    }
    const result = server?.result ?? local?.result
    if (result) {
      const name = server?.student?.name ?? local?.claims?.name ?? null
      const roll = server?.student?.roll_no ?? local?.claims?.roll ?? null
      navigator.vibrate?.(result === 'valid' ? [60] : [120, 80, 120])
      setHistory((h) => {
        const next = [{ result, name, roll, at: Date.now() }, ...h].slice(0, 8)
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
    }
    if (server && local && server.result !== local.result) syncTrust()
  }, [syncTrust])

  const reset = () => {
    busy.current = false
    setOutcome(null)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-bold sm:text-4xl">Verify a student ID</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Point your camera at the QR code on the card. Verification happens on this device first, then is confirmed by the server.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div>
          {outcome ? <ResultPanel outcome={outcome} onReset={reset} /> : <div className="card p-3 sm:p-4"><Scanner active={!outcome} onScan={handle} /></div>}
        </div>

        <aside className="space-y-6">
          <TrustPanel trust={trust} />

          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-500" />
              <h2 className="font-semibold">Try a sample card</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">No printed card? Run these real credentials through the verifier.</p>
            <div className="mt-4 grid gap-2">
              {demo.isLoading && <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner className="size-4" /> Waking up the server...</p>}
              {demo.isError && <p className="text-sm text-slate-500">Server unreachable. Sample cards need the API.</p>}
              {demo.data?.length === 0 && <p className="text-sm text-slate-500">Sample cards are disabled on this deployment.</p>}
              {demo.data?.map((d) => (
                <button key={d.kind} disabled={!!outcome} onClick={() => handle(d.token)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium transition hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50 dark:border-slate-700 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5">
                  {d.label}
                  <ResultBadge result={d.kind} />
                </button>
              ))}
            </div>
          </div>

          {history.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold"><History className="size-4 text-slate-400" /> Recent on this device</h2>
                <button className="text-xs font-medium text-slate-500 hover:text-red-600" onClick={() => { setHistory([]); try { localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ } }}>Clear</button>
              </div>
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((h) => (
                  <li key={h.at} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{h.name ?? (h.result === 'tampered' ? 'Forged card' : 'Unreadable code')}</p>
                      <p className="text-xs text-slate-500">{h.roll ? `${h.roll} · ` : ''}{timeAgo(new Date(h.at).toISOString())}</p>
                    </div>
                    <ResultBadge result={h.result} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function TrustPanel({ trust }: { trust: { key: ReturnType<typeof cachedKey>; rev: ReturnType<typeof cachedRevocations>; online: boolean } }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={clsx('grid size-11 shrink-0 place-items-center rounded-xl', trust.key ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10')}>
        {trust.online ? <KeyRound className="size-5" /> : <CloudOff className="size-5" />}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{trust.key ? (trust.online ? 'Ready: online & offline' : 'Offline mode available') : 'Connecting to server...'}</p>
        <p className="text-slate-500">
          {trust.key ? <>Public key <span className="font-mono">{trust.key.kid}</span> cached</> : 'Fetching the public key'}
          {trust.rev && <> · {trust.rev.revoked.length} revoked, list updated {timeAgo(new Date(trust.rev._fetchedAt).toISOString())}</>}
        </p>
      </div>
    </div>
  )
}

function ResultPanel({ outcome, onReset }: { outcome: Outcome; onReset: () => void }) {
  const [inspect, setInspect] = useState(false)
  const { local, server, serverState } = outcome
  const result: VerifyResult | null = server?.result ?? local?.result ?? null
  const decoded = decodeToken(outcome.token)

  if (!result) {
    return (
      <div className="card flex flex-col items-center gap-4 p-10 text-center">
        {serverState === 'pending' ? <Spinner className="size-10 text-brand-500" /> : <XCircle className="size-10 text-red-500" />}
        <p className="font-semibold">{serverState === 'pending' ? 'Contacting server... (free hosting can take ~30s to wake)' : 'Could not verify: server unreachable and no cached key yet.'}</p>
        {serverState === 'failed' && <button className="btn-primary" onClick={onReset}><RotateCcw className="size-4" /> Try again</button>}
      </div>
    )
  }

  const meta = RESULT_META[result]
  const Icon = meta.icon
  const showStudent = result !== 'tampered' && result !== 'malformed'
  const s = server?.student
  const c = local?.claims
  const person = showStudent && (s || c)
    ? {
        id: s?.id ?? c!.sid, name: s?.name ?? c!.name, roll: s?.roll_no ?? c!.roll, dept: s?.department ?? c!.dept,
        prog: s?.program ?? c!.prog, year: s?.year ?? c!.yr, blood: s?.blood_group, until: s?.valid_until ?? c!.exp,
        hasPhoto: s?.has_photo ?? false, photoVersion: s?.photo_version ?? 0,
      }
    : null

  return (
    <div className="card overflow-hidden" aria-live="polite">
      <div className={clsx('relative bg-gradient-to-br px-6 pb-8 pt-8 text-white', TONE_BG[meta.tone])}>
        <div className="grid-bg absolute inset-0 opacity-20" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-16 animate-pop place-items-center rounded-full bg-white/20 ring-4 ring-white/30">
            <Icon className="size-9" strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-white/80">{server?.institution ?? 'SecureID'}</p>
            <p className="font-display text-3xl font-bold">
              {result === 'valid' ? (serverState === 'done' ? 'Authentic ID' : 'Signature valid') : meta.label}
            </p>
          </div>
        </div>
        <p className="relative mt-4 text-white/90">{server?.message ?? localMessage(result)}</p>
      </div>

      {person && (
        <div className="flex gap-5 border-b border-slate-100 p-6 dark:border-slate-800">
          <Avatar id={person.id} name={person.name} version={person.photoVersion} hasPhoto={person.hasPhoto}
            className="aspect-[3/4] w-24 rounded-xl text-2xl ring-4 ring-slate-100 dark:ring-slate-800 sm:w-28" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold">{person.name}</p>
            <p className="font-mono text-sm text-brand-600 dark:text-brand-400">{person.roll}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="col-span-2"><dt className="text-xs text-slate-500">Department</dt><dd className="font-medium">{person.dept}</dd></div>
              <div><dt className="text-xs text-slate-500">Programme</dt><dd className="font-medium">{person.prog} · {ordinal(person.year)} yr</dd></div>
              <div><dt className="text-xs text-slate-500">Valid until</dt><dd className="font-medium">{fmtDate(person.until)}</dd></div>
              {person.blood && <div><dt className="text-xs text-slate-500">Blood group</dt><dd className="font-medium">{person.blood}</dd></div>}
            </dl>
          </div>
        </div>
      )}

      <div className="space-y-2 p-6">
        <Check icon={Smartphone} label="Signature checked on this device"
          state={!local ? 'skip' : local.result === 'tampered' || local.result === 'malformed' ? 'fail' : 'ok'}
          note={!local ? 'No cached public key yet' : undefined} />
        <Check icon={Server} label="Status confirmed by server"
          state={serverState === 'pending' ? 'pending' : serverState === 'failed' ? 'skip' : server?.result === 'valid' ? 'ok' : 'fail'}
          note={serverState === 'failed' ? 'Offline - used cached revocation list' : serverState === 'pending' ? 'Waiting for server...' : undefined} />

        {decoded && (
          <div className="pt-2">
            <button onClick={() => setInspect((v) => !v)} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
              <ChevronDown className={clsx('size-4 transition', inspect && 'rotate-180')} /> Inspect credential
            </button>
            {inspect && (
              <div className="mt-3 space-y-2 rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300">
                <p className="text-slate-500">// payload</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(decoded.claims, null, 2)}</pre>
                <p className="text-slate-500">// Ed25519 signature ({decoded.signature.length} bytes)</p>
                <p className="break-all text-emerald-400">{outcome.token.split('.')[2]}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <button className="btn-primary w-full !py-3 text-base" onClick={onReset}><ScanLine className="size-5" /> Scan next card</button>
      </div>
    </div>
  )
}

function Check({ icon: Icon, label, state, note }: { icon: typeof Server; label: string; state: 'ok' | 'fail' | 'pending' | 'skip'; note?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="size-4 text-slate-400" />
      <span className="flex-1">{label}{note && <span className="block text-xs text-slate-500">{note}</span>}</span>
      {state === 'ok' && <CheckCircle2 className="size-5 text-emerald-500" />}
      {state === 'fail' && <XCircle className="size-5 text-red-500" />}
      {state === 'pending' && <Spinner className="size-5 text-slate-400" />}
      {state === 'skip' && <CircleDashed className="size-5 text-slate-400" />}
    </div>
  )
}

function localMessage(result: VerifyResult): string {
  switch (result) {
    case 'valid': return 'Signature verified on this device. Waiting for live status from the server.'
    case 'tampered': return 'Signature check failed. The QR code was forged or altered.'
    case 'malformed': return 'This QR code is not a SecureID credential.'
    case 'revoked': return 'This card appears on the cached revocation list.'
    case 'superseded': return 'A newer card has been issued to this student.'
    case 'expired': return 'This ID card has expired.'
    default: return 'Unable to confirm this card.'
  }
}
