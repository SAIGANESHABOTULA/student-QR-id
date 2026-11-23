import {
  ArrowRight, BadgeCheck, Ban, CloudOff, FileSpreadsheet, Fingerprint, KeyRound, LayoutDashboard, Printer, QrCode, RefreshCcw, ScanLine, ShieldAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { IdCard } from '../components/IdCard'

const SAMPLE = {
  id: 'sample', name: 'Ananya Iyer', roll_no: 'P24CS004', department: 'Computer Science & Engineering',
  program: 'M.Tech', year: 1, blood_group: 'B+', valid_until: '2027-06-30', has_photo: false, card_version: 1,
}
const SAMPLE_TOKEN = 'SID1.eyJkZW1vIjp0cnVlLCJuYW1lIjoiQW5hbnlhIEl5ZXIiLCJyb2xsIjoiUDI0Q1MwMDQifQ.ZGVtby1zaWduYXR1cmUtZm9yLWxhbmRpbmctcGFnZS1wcmV2aWV3LW9ubHk'

const FEATURES = [
  { icon: Fingerprint, title: 'Ed25519 signatures', body: 'Every card carries a 64-byte digital signature. Change a single character and verification fails.' },
  { icon: CloudOff, title: 'Works offline', body: 'The verifier caches the public key and revocation list, so the gate keeps working without network.' },
  { icon: Ban, title: 'Instant revocation', body: 'Lost card? Revoke it in one click and every scanner rejects it from that moment on.' },
  { icon: RefreshCcw, title: 'Card reissue', body: 'Issue a replacement card and the old printed QR is automatically marked as superseded.' },
  { icon: LayoutDashboard, title: 'Live dashboard', body: 'Track scans, blocked forgeries and departments at a glance, with a full audit log.' },
  { icon: FileSpreadsheet, title: 'Bulk CSV import', body: 'Onboard a whole batch from a spreadsheet, then print or download each card as an image.' },
]

const STEPS = [
  { icon: KeyRound, title: 'Issue', body: 'The admin adds a student. The server signs their details with a private key that never leaves it.' },
  { icon: Printer, title: 'Print', body: 'The signed credential is encoded into a QR code on a CR80-size ID card, ready to print or share.' },
  { icon: ScanLine, title: 'Verify', body: 'Any phone scans the card. The signature is checked on-device, then status is confirmed with the server.' },
]

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl dark:bg-brand-500/15" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:py-24 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              <BadgeCheck className="size-3.5" /> Cryptographically verifiable student IDs
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-6xl">
              ID cards that <span className="bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">can't be faked.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
              SecureID issues digitally signed QR codes for student ID cards. Security staff verify any card in under a second, even
              offline, and forged, expired or revoked cards are caught instantly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/verify" className="btn-primary !px-5 !py-3 text-base"><ScanLine className="size-5" /> Try the verifier</Link>
              <Link to="/login" className="btn-secondary !px-5 !py-3 text-base">Admin console <ArrowRight className="size-4" /></Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">No card handy? The verifier includes sample genuine and forged cards to test.</p>
          </div>
          <div className="relative mx-auto w-full max-w-[480px] animate-float">
            <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-brand-500/30 to-sky-400/30 blur-2xl" />
            <IdCard student={SAMPLE} token={SAMPLE_TOKEN} kid="3f9a1c2e" />
            <div className="absolute -bottom-5 -right-2 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10 sm:-right-6">
              <span className="grid size-9 place-items-center rounded-full bg-emerald-500 text-white"><BadgeCheck className="size-5" /></span>
              <div className="text-sm leading-tight"><p className="font-semibold">Verified</p><p className="text-slate-500">Signature valid · 0.2s</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">How it works</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Public-key cryptography, made practical</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="card relative p-6">
              <span className="absolute right-5 top-4 font-display text-5xl font-bold text-slate-100 dark:text-slate-800">{i + 1}</span>
              <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"><Icon className="size-5" /></span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Token anatomy */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="card overflow-hidden lg:grid lg:grid-cols-[1fr_1.2fr]">
          <div className="p-8">
            <QrCode className="size-8 text-brand-600 dark:text-brand-400" />
            <h2 className="mt-4 text-2xl font-bold">What's inside the QR?</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              A compact, self-contained credential: the student's details plus a signature over those exact bytes. The verifier only needs the
              institution's <em>public</em> key, so a leaked scanner can never be used to mint fake cards.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-500" /> Editing a name, roll number or expiry breaks the signature.</li>
              <li className="flex gap-2"><Ban className="mt-0.5 size-4 shrink-0 text-amber-500" /> Revoked and replaced cards are rejected using the institution's live list.</li>
            </ul>
          </div>
          <pre className="overflow-x-auto bg-slate-950 p-8 font-mono text-[13px] leading-relaxed text-slate-300">
{`SID1.`}<span className="text-sky-400">{`<payload>`}</span>{`.`}<span className="text-emerald-400">{`<signature>`}</span>{`

`}<span className="text-slate-500">{`// payload (base64url JSON)`}</span>{`
{
  "sid":  "9f2c...e1",       `}<span className="text-slate-500">{`// student id`}</span>{`
  "roll": "P24CS004",
  "name": "Ananya Iyer",
  "dept": "Computer Science & Engineering",
  "prog": "M.Tech", "yr": 1,
  "exp":  "2027-06-30",      `}<span className="text-slate-500">{`// expiry`}</span>{`
  "cv":   1,                 `}<span className="text-slate-500">{`// card version`}</span>{`
  "kid":  "3f9a1c2e",        `}<span className="text-slate-500">{`// signing key id`}</span>{`
  "iat":  1764000000
}

`}<span className="text-slate-500">{`// signature: Ed25519, 64 bytes`}</span>
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-slate-200/70 bg-white py-16 dark:border-slate-800/70 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">Everything a campus needs</h2>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"><Icon className="size-5" /></span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-sky-600 px-8 py-14 text-center text-white">
          <div className="grid-bg absolute inset-0 opacity-30" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">See it catch a forgery</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/80">Open the verifier and test a genuine card next to an edited one, or point your camera at any printed SecureID card.</p>
          <Link to="/verify" className="btn relative mt-8 bg-white !px-6 !py-3 text-base text-brand-700 hover:bg-brand-50"><ScanLine className="size-5" /> Open verifier</Link>
        </div>
      </section>
    </>
  )
}
