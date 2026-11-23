import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Download, FileUp, Plus, Search, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '../../components/Layouts'
import { StudentForm } from '../../components/StudentForm'
import { Avatar, EmptyState, Modal, Spinner, StatusBadge } from '../../components/ui'
import { api, type StudentInput } from '../../lib/api'
import { displayStatus, fmtDate } from '../../lib/format'

const PAGE = 20
const STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
]

export default function Students() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPage(0) }, 250)
    return () => clearTimeout(t)
  }, [q])

  const list = useQuery({
    queryKey: ['students', search, department, status, page],
    queryFn: () => api.students({ q: search, department, status, limit: PAGE, offset: page * PAGE }),
    placeholderData: keepPreviousData,
  })
  const depts = useQuery({ queryKey: ['departments'], queryFn: api.departments })

  const create = useMutation({
    mutationFn: async ({ data, photo }: { data: StudentInput; photo: File | null }) => {
      const s = await api.createStudent(data)
      if (photo) await api.uploadPhoto(s.id, photo).catch(() => toast.error('Student saved, but the photo upload failed'))
      return s
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
      toast.success(`${s.name} added. Their ID card is ready.`)
      setAdding(false)
      navigate(`/admin/students/${s.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const exportCsv = async () => {
    try {
      const blob = await api.exportCsv()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'students.csv'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${total} ${total === 1 ? 'student' : 'students'}${search || department || status ? ' match your filters' : ' on record'}`}
        actions={<>
          <button className="btn-secondary" onClick={exportCsv}><Download className="size-4" /> Export</button>
          <button className="btn-secondary" onClick={() => setImporting(true)}><FileUp className="size-4" /> Import CSV</button>
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="size-4" /> Add student</button>
        </>}
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Search by name, roll number or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input md:!w-60" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(0) }}>
          <option value="">All departments</option>
          {depts.data?.map((d) => <option key={d}>{d}</option>)}
        </select>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {STATUSES.map((s) => (
            <button key={s.value} onClick={() => { setStatus(s.value); setPage(0) }}
              className={clsx('flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition', status === s.value ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {list.isLoading ? (
          <div className="grid h-48 place-items-center"><Spinner className="size-7 text-brand-500" /></div>
        ) : list.isError ? (
          <EmptyState icon={Users} title="Couldn't load students">{(list.error as Error).message}</EmptyState>
        ) : !list.data?.items.length ? (
          <EmptyState icon={Users} title={search || department || status ? 'No matches' : 'No students yet'}>
            {search || department || status ? 'Try a different search or filter.' : 'Add a student or import a CSV to issue the first ID card.'}
          </EmptyState>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="hidden border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-header-group dark:border-slate-800 dark:bg-slate-800/30">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Valid until</th>
                  <th className="px-5 py-3 text-right">Scans</th>
                </tr>
              </thead>
              <tbody className={clsx('divide-y divide-slate-100 dark:divide-slate-800', list.isFetching && 'opacity-60')}>
                {list.data.items.map((s) => (
                  <tr key={s.id} className="group cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => navigate(`/admin/students/${s.id}`)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar id={s.id} name={s.name} version={s.photo_version} hasPhoto={s.has_photo} />
                        <div className="min-w-0">
                          <Link to={`/admin/students/${s.id}`} className="block truncate font-semibold group-hover:text-brand-600" onClick={(e) => e.stopPropagation()}>{s.name}</Link>
                          <p className="font-mono text-xs text-slate-500">{s.roll_no}<span className="font-sans md:hidden"> · {s.department}</span></p>
                        </div>
                        <span className="ml-auto md:hidden"><StatusBadge status={displayStatus(s)} /></span>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 md:table-cell dark:text-slate-300">
                      {s.department}<span className="block text-xs text-slate-500">{s.program} · Year {s.year}</span>
                    </td>
                    <td className="hidden px-5 py-3 md:table-cell"><StatusBadge status={displayStatus(s)} /></td>
                    <td className="hidden px-5 py-3 text-slate-600 md:table-cell dark:text-slate-300">{fmtDate(s.valid_until)}</td>
                    <td className="hidden px-5 py-3 text-right tabular-nums text-slate-600 md:table-cell dark:text-slate-300">{s.scan_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <Modal open={adding} onClose={() => setAdding(false)} title="Add student" wide>
        <StudentForm departments={depts.data ?? []} busy={create.isPending} submitLabel="Create & issue card"
          onSubmit={(data, photo) => create.mutate({ data, photo })} />
      </Modal>

      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </>
  )
}

const TEMPLATE = 'roll_no,name,department,program,year,email,blood_group,valid_until\nP24CS101,Asha Menon,Computer Science & Engineering,M.Tech,1,asha@example.edu,O+,2027-06-30\n'

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const run = useMutation({
    mutationFn: (f: File) => api.importCsv(f),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
      toast.success(`Imported: ${r.created} new, ${r.updated} updated`)
      if (!r.errors.length) close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const close = () => { setFile(null); run.reset(); onClose() }
  const template = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    a.download = 'students-template.csv'
    a.click()
  }

  return (
    <Modal open={open} onClose={close} title="Import students from CSV">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Required columns: <code className="font-mono text-xs">roll_no, name, department</code>. Existing roll numbers are updated.{' '}
        <button onClick={template} className="font-medium text-brand-600 hover:underline dark:text-brand-400">Download template</button>
      </p>
      <button onClick={() => fileRef.current?.click()}
        className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 hover:border-brand-400 dark:border-slate-700">
        <FileUp className="size-7 text-slate-400" />
        {file ? <span className="font-medium text-slate-800 dark:text-slate-200">{file.name}</span> : 'Choose a .csv file'}
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {run.data?.errors.length ? (
        <div className="mt-4 max-h-40 overflow-y-auto rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="mb-1 font-semibold">{run.data.errors.length} rows skipped</p>
          {run.data.errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={close}>Close</button>
        <button className="btn-primary" disabled={!file || run.isPending} onClick={() => file && run.mutate(file)}>
          {run.isPending && <Spinner className="size-4" />} Import
        </button>
      </div>
    </Modal>
  )
}
