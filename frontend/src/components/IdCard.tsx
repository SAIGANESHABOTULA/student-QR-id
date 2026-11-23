import { ShieldCheck } from 'lucide-react'
import { forwardRef } from 'react'
import { fmtDate, ordinal } from '../lib/format'
import { QrImage } from './QrImage'
import { Avatar } from './ui'

export interface IdCardData {
  id: string
  name: string
  roll_no: string
  department: string
  program: string
  year: number
  blood_group?: string | null
  valid_until: string
  has_photo?: boolean
  photo_version?: number
  card_version?: number
}

/** A CR80-proportioned (85.6 x 54 mm) student ID card. */
export const IdCard = forwardRef<HTMLDivElement, { student: IdCardData; token?: string; institution?: string; kid?: string }>(
  function IdCard({ student, token, institution = 'SVNIT Surat', kid }, ref) {
    return (
      <div
        ref={ref}
        className="relative aspect-[85.6/54] w-full max-w-[520px] overflow-hidden rounded-[18px] bg-white text-slate-900 shadow-2xl shadow-brand-900/20 ring-1 ring-slate-900/5"
        style={{ containerType: 'inline-size' }}
      >
        {/* Header band */}
        <div className="absolute inset-x-0 top-0 flex h-[22%] items-center justify-between bg-gradient-to-r from-brand-700 via-brand-600 to-sky-600 px-[4.5cqw] text-white">
          <div className="flex items-center gap-[2cqw]">
            <span className="grid size-[7cqw] place-items-center rounded-[1.6cqw] bg-white/15 ring-1 ring-white/30">
              <ShieldCheck className="size-[4.6cqw]" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-[3.6cqw] font-bold tracking-wide">{institution}</p>
              <p className="text-[2.1cqw] uppercase tracking-[0.2em] text-white/75">Student Identity Card</p>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-[2cqw] py-[0.6cqw] text-[2cqw] font-semibold uppercase tracking-wider ring-1 ring-white/30">
            {student.program}
          </span>
        </div>

        {/* Watermark */}
        <ShieldCheck className="pointer-events-none absolute -bottom-[8cqw] left-[30%] size-[48cqw] text-brand-500/[0.05]" strokeWidth={1.2} />

        {/* Body */}
        <div className="absolute inset-x-0 bottom-[11%] top-[22%] flex items-center gap-[4cqw] px-[4.5cqw]">
          <Avatar
            id={student.id}
            name={student.name}
            version={student.photo_version}
            hasPhoto={student.has_photo ?? true}
            className="aspect-[3/4] w-[20cqw] rounded-[2cqw] text-[6cqw] ring-[0.6cqw] ring-brand-100"
          />
          <div className="min-w-0 flex-1 space-y-[1.4cqw]">
            <p className="truncate font-display text-[4.8cqw] font-bold leading-tight">{student.name}</p>
            <p className="font-mono text-[3cqw] font-medium text-brand-700">{student.roll_no}</p>
            <div className="grid grid-cols-2 gap-x-[2cqw] gap-y-[1cqw] pt-[0.6cqw] text-[2.3cqw]">
              <Field label="Department" value={student.department} span />
              <Field label="Year" value={`${ordinal(student.year)} year`} />
              <Field label="Blood group" value={student.blood_group || '-'} />
              <Field label="Valid until" value={fmtDate(student.valid_until)} span />
            </div>
          </div>
          <div className="flex flex-col items-center gap-[0.8cqw]">
            <div className="rounded-[1.6cqw] bg-white p-[0.8cqw] ring-1 ring-slate-200">
              {token ? <QrImage value={token} size={150} className="size-[24cqw]" /> : <div className="size-[24cqw] rounded bg-slate-100" />}
            </div>
            <p className="text-[1.7cqw] font-medium uppercase tracking-wider text-slate-400">Scan to verify</p>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute inset-x-0 bottom-0 flex h-[11%] items-center justify-between border-t border-slate-100 bg-slate-50 px-[4.5cqw] text-[1.9cqw] text-slate-500">
          <span>Ed25519 digitally signed{kid ? ` · key ${kid}` : ''}</span>
          <span>Card v{student.card_version ?? 1}</span>
        </div>
      </div>
    )
  },
)

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2 min-w-0' : 'min-w-0'}>
      <p className="text-[1.8cqw] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-700">{value}</p>
    </div>
  )
}
