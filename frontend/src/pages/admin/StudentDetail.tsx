import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import {
  ArrowLeft, Ban, Camera, Copy, Download, History, Pencil, Printer, RefreshCcw, ShieldCheck, Trash2, UserX,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { IdCard } from '../../components/IdCard'
import { StudentForm } from '../../components/StudentForm'
import { ConfirmModal, EmptyState, Modal, ResultBadge, Spinner, StatusBadge } from '../../components/ui'
import { api, type Student } from '../../lib/api'
import { displayStatus, fmtDate, timeAgo } from '../../lib/format'

export default function StudentDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [dialog, setDialog] = useState<null | 'edit' | 'revoke' | 'reissue' | 'delete'>(null)
  const [reason, setReason] = useState('Card reported lost')
  const [downloading, setDownloading] = useState(false)

  const student = useQuery({ queryKey: ['student', id], queryFn: () => api.student(id) })
  const cred = useQuery({
    queryKey: ['credential', id],
    queryFn: () => api.credential(id),
    enabled: !!student.data,
  })
  const scans = useQuery({ queryKey: ['scans', 'student', id], queryFn: () => api.scans({ student_id: id, limit: 15 }) })
  const depts = useQuery({ queryKey: ['departments'], queryFn: api.departments })

  const onSaved = (s: Student, msg: string) => {
    qc.setQueryData(['student', id], s)
    qc.invalidateQueries({ queryKey: ['students'] })
    qc.invalidateQueries({ queryKey: ['credential', id] })
    toast.success(msg)
    setDialog(null)
  }
  const onError = (e: Error) => toast.error(e.message)

  const update = useMutation({ mutationFn: (d: Parameters<typeof api.updateStudent>[1]) => api.updateStudent(id, d), onSuccess: (s) => onSaved(s, 'Details updated. The QR has been re-signed.'), onError })
  const photo = useMutation({ mutationFn: (f: File) => api.uploadPhoto(id, f), onSuccess: (s) => onSaved(s, 'Photo updated'), onError })
  const revoke = useMutation({ mutationFn: () => api.revoke(id, reason), onSuccess: (s) => onSaved(s, 'Card revoked. Scanners will now reject it.'), onError })
  const reinstate = useMutation({ mutationFn: () => api.reinstate(id), onSuccess: (s) => onSaved(s, 'Card reinstated'), onError })
  const reissue = useMutation({ mutationFn: () => api.reissue(id), onSuccess: (s) => onSaved(s, `Card v${s.card_version} issued. Older cards are now invalid.`), onError })
  const remove = useMutation({
    mutationFn: () => api.deleteStudent(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); toast.success('Student deleted'); navigate('/admin/students') },
    onError,
  })

  if (student.isLoading) return <div className="grid h-64 place-items-center"><Spinner className="size-8 text-brand-500" /></div>
  if (!student.data) return <EmptyState icon={UserX} title="Student not found"><Link to="/admin/students" className="text-brand-600">Back to students</Link></EmptyState>

  const s = student.data
  const st = displayStatus(s)

  const download = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = `${s.roll_no}-id-card.png`
      a.click()
    } catch {
      toast.error('Could not render the card image')
    } finally {
      setDownloading(false)
    }
  }

  const copyToken = async () => {
    if (!cred.data) return
    await navigator.clipboard.writeText(cred.data.token)
    toast.success('Credential copied')
  }

  return (
    <>
      <Link to="/admin/students" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600"><ArrowLeft className="size-4" /> Students</Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold sm:text-3xl">{s.name}</h1><StatusBadge status={st} /></div>
          <p className="mt-1 font-mono text-sm text-slate-500">{s.roll_no}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setDialog('edit')}><Pencil className="size-4" /> Edit</button>
          <button className="btn-secondary" onClick={() => photoRef.current?.click()} disabled={photo.isPending}>
            {photo.isPending ? <Spinner className="size-4" /> : <Camera className="size-4" />} Photo
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) photo.mutate(f); e.target.value = '' }} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="card self-start p-5 sm:p-8">
          <div className="print-area flex justify-center">
            <IdCard ref={cardRef} student={s} token={cred.data?.token} kid={cred.data?.kid} />
          </div>
          {s.status === 'revoked' && (
            <p className="mx-auto mt-5 flex max-w-[520px] items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              <Ban className="size-4 shrink-0" /> Revoked: {s.revoked_reason}. This card fails verification.
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className="btn-primary" onClick={download} disabled={downloading || !cred.data}>{downloading ? <Spinner className="size-4" /> : <Download className="size-4" />} Download PNG</button>
            <button className="btn-secondary" onClick={() => window.print()} disabled={!cred.data}><Printer className="size-4" /> Print</button>
            <button className="btn-secondary" onClick={copyToken} disabled={!cred.data}><Copy className="size-4" /> Copy credential</button>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">Card controls</h2>
            <div className="mt-4 space-y-3">
              {s.status === 'revoked' ? (
                <Action icon={ShieldCheck} title="Reinstate card" body="Allow this card to verify again." onClick={() => reinstate.mutate()} busy={reinstate.isPending} />
              ) : (
                <Action icon={Ban} title="Revoke card" body="Block every copy of this card immediately." onClick={() => setDialog('revoke')} danger />
              )}
              <Action icon={RefreshCcw} title={`Reissue card (now v${s.card_version})`} body="Print a replacement. All older printed cards stop working." onClick={() => setDialog('reissue')} />
              <Action icon={Trash2} title="Delete student" body="Remove the record. Their cards become unknown." onClick={() => setDialog('delete')} danger />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Info label="Department" value={s.department} span />
              <Info label="Programme" value={`${s.program}, year ${s.year}`} />
              <Info label="Blood group" value={s.blood_group ?? '-'} />
              <Info label="Email" value={s.email ?? '-'} span />
              <Info label="Valid until" value={fmtDate(s.valid_until)} />
              <Info label="Added" value={fmtDate(s.created_at)} />
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-semibold"><History className="size-4 text-slate-400" /> Scan history <span className="font-normal text-slate-500">({scans.data?.total ?? 0})</span></h2>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {scans.data?.items.length === 0 && <li className="py-4 text-sm text-slate-500">This card hasn't been scanned yet.</li>}
              {scans.data?.items.map((sc) => (
                <li key={sc.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-slate-600 dark:text-slate-300" title={new Date(sc.created_at).toLocaleString()}>{timeAgo(sc.created_at)}</span>
                  <ResultBadge result={sc.result} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Modal open={dialog === 'edit'} onClose={() => setDialog(null)} title="Edit student" wide>
        <StudentForm initial={s} departments={depts.data ?? []} busy={update.isPending} submitLabel="Save changes" onSubmit={(d) => update.mutate(d)} />
      </Modal>
      <ConfirmModal open={dialog === 'revoke'} onClose={() => setDialog(null)} onConfirm={() => revoke.mutate()} busy={revoke.isPending} danger
        title="Revoke this card?" confirmLabel="Revoke card" body={<>Every scanner will reject <b>{s.name}</b>'s card, including offline scanners once they sync.</>}>
        <label className="label mt-4">Reason</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
      </ConfirmModal>
      <ConfirmModal open={dialog === 'reissue'} onClose={() => setDialog(null)} onConfirm={() => reissue.mutate()} busy={reissue.isPending}
        title="Reissue card?" confirmLabel={`Issue v${s.card_version + 1}`} body="A new QR is signed. Previously printed cards will verify as 'Old card' and be rejected." />
      <ConfirmModal open={dialog === 'delete'} onClose={() => setDialog(null)} onConfirm={() => remove.mutate()} busy={remove.isPending} danger
        title="Delete student?" confirmLabel="Delete permanently" body={<>This removes <b>{s.name}</b> and cannot be undone. Scan history is kept but unlinked.</>} />
    </>
  )
}

function Action({ icon: Icon, title, body, onClick, danger, busy }: { icon: typeof Ban; title: string; body: string; onClick: () => void; danger?: boolean; busy?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
      <span className={danger ? 'text-red-500' : 'text-brand-500'}>{busy ? <Spinner className="size-5" /> : <Icon className="size-5" />}</span>
      <span><span className="block text-sm font-semibold">{title}</span><span className="text-xs text-slate-500">{body}</span></span>
    </button>
  )
}

function Info({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  )
}
