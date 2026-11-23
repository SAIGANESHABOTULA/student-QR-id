import { Camera } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Student, StudentInput } from '../lib/api'
import { initials } from '../lib/format'
import { Spinner } from './ui'

const PROGRAMS = ['M.Tech', 'B.Tech', 'M.Sc', 'MBA', 'Ph.D']
const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

export function StudentForm({ initial, departments, busy, onSubmit, submitLabel }: {
  initial?: Student
  departments: string[]
  busy: boolean
  submitLabel: string
  onSubmit: (data: StudentInput, photo: File | null) => void
}) {
  const [data, setData] = useState<StudentInput>(() => ({
    roll_no: initial?.roll_no ?? '', name: initial?.name ?? '', department: initial?.department ?? '',
    program: initial?.program ?? 'M.Tech', year: initial?.year ?? 1, email: initial?.email ?? '',
    blood_group: initial?.blood_group ?? '', valid_until: initial?.valid_until ?? '',
  }))
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!photo) return setPreview(null)
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const set = <K extends keyof StudentInput>(k: K, v: StudentInput[K]) => setData((d) => ({ ...d, [k]: v }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ ...data, email: data.email || null, blood_group: data.blood_group || null, valid_until: data.valid_until || undefined }, photo)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!initial && (
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="group relative grid aspect-[3/4] w-20 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800">
            {preview ? <img src={preview} alt="" className="size-full object-cover" /> : data.name ? <span className="font-display text-xl font-semibold">{initials(data.name)}</span> : <Camera className="size-6" />}
          </button>
          <div className="text-sm">
            <p className="font-medium">Photo</p>
            <p className="text-slate-500">Optional. Auto-cropped to passport size.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="input" required value={data.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Roll number"><input className="input font-mono uppercase" required value={data.roll_no} onChange={(e) => set('roll_no', e.target.value)} placeholder="P24CS001" /></Field>
        <Field label="Department" span>
          <input className="input" required list="departments" value={data.department} onChange={(e) => set('department', e.target.value)} />
          <datalist id="departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="Programme">
          <select className="input" value={data.program} onChange={(e) => set('program', e.target.value)}>
            {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Year">
          <select className="input" value={data.year} onChange={(e) => set('year', Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </Field>
        <Field label="Email"><input className="input" type="email" value={data.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Blood group">
          <select className="input" value={data.blood_group ?? ''} onChange={(e) => set('blood_group', e.target.value)}>
            {BLOOD.map((b) => <option key={b} value={b}>{b || 'Not set'}</option>)}
          </select>
        </Field>
        <Field label="Valid until" span>
          <input className="input" type="date" value={data.valid_until ?? ''} onChange={(e) => set('valid_until', e.target.value)} />
          {!initial && <p className="mt-1 text-xs text-slate-500">Leave empty for one year from today.</p>}
        </Field>
      </div>
      <div className="flex justify-end pt-2">
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="size-4" />} {submitLabel}</button>
      </div>
    </form>
  )
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return <div className={span ? 'sm:col-span-2' : ''}><label className="label">{label}</label>{children}</div>
}
