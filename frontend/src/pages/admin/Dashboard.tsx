import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, ShieldAlert, UserCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import { PageHeader } from '../../components/Layouts'
import { EmptyState, RESULT_META, ResultBadge, Spinner } from '../../components/ui'
import { api, type VerifyResult } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import { useTheme } from '../../lib/theme'

// Status colours (valid = good, blocked = critical) and a single series hue for magnitude.
const GOOD = '#0ca30c'
const CRITICAL = '#d03b3b'
const SERIES = { light: '#2a78d6', dark: '#3987e5' }

export default function Dashboard() {
  const { dark } = useTheme()
  const { data, isLoading, error } = useQuery({ queryKey: ['stats'], queryFn: () => api.stats(), refetchInterval: 30_000 })

  if (isLoading) return <div className="grid h-64 place-items-center"><Spinner className="size-8 text-brand-500" /></div>
  if (error || !data) return <EmptyState icon={ShieldAlert} title="Couldn't load dashboard">{(error as Error)?.message}</EmptyState>

  const grid = dark ? '#1e293b' : '#e2e8f0'
  const axis = dark ? '#94a3b8' : '#64748b'
  const daily = data.daily.map((d) => ({ ...d, label: new Date(`${d.day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }))
  const depts = Object.entries(data.by_department).map(([name, count]) => ({ name: name.replace(' Engineering', ' Engg.').replace('Computer Science & Engg.', 'CSE'), full: name, count }))
  const blockRate = data.scans_total ? Math.round((data.scans_invalid / data.scans_total) * 100) : 0
  const results = (Object.entries(data.by_result) as [VerifyResult, number][]).sort((a, b) => b[1] - a[1])
  const maxResult = Math.max(1, ...results.map(([, n]) => n))

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live overview of issued cards and verification activity." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} label="Students" value={data.students_total} hint={`${data.students_revoked} revoked · ${data.students_expired} expired`} />
        <Kpi icon={UserCheck} label="Active cards" value={data.students_active} hint={`${Math.round((data.students_active / Math.max(1, data.students_total)) * 100)}% of all cards`} />
        <Kpi icon={Activity} label="Scans today" value={data.scans_today} hint={`${data.scans_total} all time`} />
        <Kpi icon={ShieldAlert} label="Blocked scans" value={data.scans_invalid} hint={`${blockRate}% of all scans`} alert />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Scans per day <span className="font-normal text-slate-500">· last 14 days</span></h2>
            <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400">
              <Legend color={GOOD} label="Verified" />
              <Legend color={CRITICAL} label="Blocked" />
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={daily} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11 }} />
                <Tooltip cursor={{ fill: dark ? '#ffffff0d' : '#0f172a0a' }} content={<DayTooltip />} />
                <Bar dataKey="valid" name="Verified" stackId="a" fill={GOOD} stroke={dark ? '#0f172a' : '#fff'} strokeWidth={2} />
                <Bar dataKey="invalid" name="Blocked" stackId="a" fill={CRITICAL} radius={[4, 4, 0, 0]} stroke={dark ? '#0f172a' : '#fff'} strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Verification outcomes</h2>
          <ul className="mt-4 space-y-3">
            {results.length === 0 && <li className="text-sm text-slate-500">No scans yet.</li>}
            {results.map(([result, n]) => (
              <li key={result} className="text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <ResultBadge result={result} />
                  <span className="font-semibold tabular-nums">{n}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${(n / maxResult) * 100}%`, background: RESULT_META[result]?.tone === 'good' ? GOOD : RESULT_META[result]?.tone === 'warn' ? '#fab219' : CRITICAL }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Students by department</h2>
          <div className="mt-4" style={{ height: Math.max(160, depts.length * 40) }}>
            <ResponsiveContainer>
              <BarChart data={depts} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12 }} />
                <Tooltip cursor={{ fill: dark ? '#ffffff0d' : '#0f172a0a' }} content={<DeptTooltip />} />
                <Bar dataKey="count" fill={dark ? SERIES.dark : SERIES.light} radius={[0, 4, 4, 0]} barSize={18}
                  label={{ position: 'right', fill: axis, fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent scans</h2>
            <Link to="/admin/scans" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {data.recent.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No scans yet. Open the verifier to try one.</li>}
            {data.recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  {s.student_id ? (
                    <Link to={`/admin/students/${s.student_id}`} className="block truncate font-medium hover:text-brand-600">{s.student_name ?? s.roll_no}</Link>
                  ) : (
                    <p className="truncate font-medium text-slate-500">Unidentified card</p>
                  )}
                  <p className="text-xs text-slate-500">{s.roll_no ? `${s.roll_no} · ` : ''}{timeAgo(s.created_at)}</p>
                </div>
                <ResultBadge result={s.result} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function Kpi({ icon: Icon, label, value, hint, alert }: { icon: typeof Users; label: string; value: number; hint: string; alert?: boolean }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={alert ? 'text-red-500' : 'text-brand-500'}><Icon className="size-5" /></span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value.toLocaleString('en-IN')}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: color }} />{label}</span>
)

function DayTooltip({ active, payload, label }: TooltipProps<number, string> & { payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="size-2 rounded-sm" style={{ background: p.color }} /> {p.name}: <span className="font-semibold text-slate-900 dark:text-white">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function DeptTooltip({ active, payload }: { active?: boolean; payload?: { payload: { full: string; count: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="font-semibold">{d.full}</p>
      <p className="text-slate-600 dark:text-slate-300">{d.count} students</p>
    </div>
  )
}
