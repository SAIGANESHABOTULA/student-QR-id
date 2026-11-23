import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/Layouts'
import { EmptyState, ResultBadge, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { timeAgo } from '../../lib/format'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'valid', label: 'Verified' },
  { value: 'invalid', label: 'All blocked' },
  { value: 'tampered', label: 'Forged' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
  { value: 'superseded', label: 'Old card' },
]
const PAGE = 25

export default function Scans() {
  const [result, setResult] = useState('')
  const [page, setPage] = useState(0)
  const q = useQuery({
    queryKey: ['scans', result, page],
    queryFn: () => api.scans({ result, limit: PAGE, offset: page * PAGE }),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  })
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE))

  return (
    <>
      <PageHeader title="Scan log" subtitle="Every verification attempt, including forged and unreadable codes." />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => { setResult(f.value); setPage(0) }}
            className={clsx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
              result === f.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700')}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        {q.isLoading ? (
          <div className="grid h-48 place-items-center"><Spinner className="size-7 text-brand-500" /></div>
        ) : !q.data?.items.length ? (
          <EmptyState icon={ScrollText} title="No scans here yet" />
        ) : (
          <>
            <ul className={clsx('divide-y divide-slate-100 dark:divide-slate-800', q.isFetching && 'opacity-70')}>
              {q.data.items.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="w-36 shrink-0"><ResultBadge result={s.result} /></div>
                  <div className="min-w-0 flex-1">
                    {s.student_id ? (
                      <Link to={`/admin/students/${s.student_id}`} className="font-medium hover:text-brand-600">{s.student_name ?? s.roll_no}</Link>
                    ) : (
                      <span className="font-medium text-slate-500">{s.roll_no ? `Claimed roll ${s.roll_no}` : 'Unidentified card'}</span>
                    )}
                    <p className="truncate text-xs text-slate-500">{s.reason}</p>
                  </div>
                  <time className="shrink-0 text-xs text-slate-500" title={new Date(s.created_at).toLocaleString()}>{timeAgo(s.created_at)}</time>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
                <span className="text-slate-500">Page {page + 1} of {pages}</span>
                <div className="flex gap-2">
                  <button className="btn-secondary !p-2" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
                  <button className="btn-secondary !p-2" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="size-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
